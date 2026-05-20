from dataclasses import dataclass
import asyncio
import base64
from http import HTTPStatus
import logging
import os
from pathlib import Path
import subprocess
import tempfile
import time
from typing import Dict, Tuple

import dashscope
import edge_tts
import httpx
from dashscope.audio.asr import Recognition
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

logger = logging.getLogger("voice-service")


@dataclass(frozen=True)
class PersonaVoiceProfile:
    edge_voice: str
    edge_rate: str
    edge_pitch: str
    qwen_voice: str
    qwen_instruction: str


PERSONA_PROFILES: Dict[str, PersonaVoiceProfile] = {
    "dongmingzhu": PersonaVoiceProfile(
        edge_voice="zh-CN-XiaoxiaoNeural",
        edge_rate="+4%",
        edge_pitch="-3Hz",
        qwen_voice="Serena",
        qwen_instruction=(
            "请模仿强势女企业高管的表达风格：短句、直接、压迫感明显。"
            "语速偏快，语调有起伏，语气干练且专业。"
        ),
    ),
    "leijun": PersonaVoiceProfile(
        edge_voice="zh-CN-YunxiNeural",
        edge_rate="+1%",
        edge_pitch="-1Hz",
        qwen_voice="Ethan",
        qwen_instruction=(
            "请模仿温和理性的企业创始人风格：表达克制、逻辑清晰、引导感强。"
            "语速中等，语气诚恳，尾音自然。"
        ),
    ),
    "musk": PersonaVoiceProfile(
        edge_voice="zh-CN-YunyangNeural",
        edge_rate="+6%",
        edge_pitch="-4Hz",
        qwen_voice="Chelsie",
        qwen_instruction=(
            "请模仿技术创始人面试风格：第一性原理、追问底层原因、挑战式语气。"
            "语速中快，停顿短，语气锋利但不失专业。"
        ),
    ),
    "trump": PersonaVoiceProfile(
        edge_voice="zh-CN-YunjianNeural",
        edge_rate="+8%",
        edge_pitch="-6Hz",
        qwen_voice="Cherry",
        qwen_instruction=(
            "请模仿强势高能的商业领袖风格：节奏强、感染力高、带挑战性。"
            "语速偏快，重音明显，语气高压且清晰。"
        ),
    ),
}

DASHSCOPE_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
DASHSCOPE_MODEL = os.getenv("VOICE_QWEN_MODEL", "qwen3-tts-instruct-flash").strip() or "qwen3-tts-instruct-flash"
ASR_MODEL = os.getenv("VOICE_ASR_MODEL", "paraformer-realtime-v2").strip() or "paraformer-realtime-v2"
MAX_AUDIO_BYTES = 12 * 1024 * 1024
VOICE_RUNTIME_CONFIG_URL = (os.getenv("VOICE_RUNTIME_CONFIG_URL") or "").strip()
VOICE_RUNTIME_CONFIG_TOKEN = (os.getenv("VOICE_RUNTIME_CONFIG_TOKEN") or "").strip()
VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS = max(float(os.getenv("VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS", "4") or "4"), 1.0)
VOICE_RUNTIME_CONFIG_TTL_SECONDS = max(float(os.getenv("VOICE_RUNTIME_CONFIG_TTL_SECONDS", "60") or "60"), 5.0)
_RUNTIME_KEY_CACHE = {
    "value": "",
    "expires_at": 0.0,
}


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    personaKey: str = Field(default="dongmingzhu", min_length=1, max_length=64)
    styleHint: str | None = Field(default=None, max_length=120)


class TranscribeResponse(BaseModel):
    text: str
    provider: str = "dashscope"


app = FastAPI(title="Interview Voice Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": DASHSCOPE_MODEL,
    }


@app.post("/api/voice/synthesize")
async def synthesize(req: SynthesizeRequest):
    # AI辅助生成：DeepSeek-R1, 2026-05-05
    persona_key = req.personaKey.strip().lower()
    profile = PERSONA_PROFILES.get(persona_key) or PERSONA_PROFILES["dongmingzhu"]
    text = req.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="text is empty")

    provider = "dashscope"
    try:
        audio_bytes, media_type = await _synthesize_by_dashscope(
            text=text,
            profile=profile,
            style_hint=req.styleHint,
        )
    except Exception:
        try:
            provider = "edge-fallback"
            audio_bytes = await _synthesize_by_edge(
                text=text,
                voice=profile.edge_voice,
                rate=profile.edge_rate,
                pitch=profile.edge_pitch,
            )
            media_type = "audio/mpeg"
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"voice synth failed: {exc}") from exc

    logger.info("voice synthesized provider=%s persona=%s len=%s", provider, persona_key, len(text))
    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "Cache-Control": "no-store",
            "X-Voice-Provider": provider,
        },
    )


@app.post("/api/voice/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: UploadFile = File(...)):
    # AI辅助生成：DeepSeek-R1, 2026-05-05
    filename = (audio.filename or "recording").strip()
    suffix = _resolve_suffix(filename, audio.content_type)
    raw_bytes = await audio.read()

    if not raw_bytes:
        raise HTTPException(status_code=400, detail="音频内容为空")
    if len(raw_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="录音文件过大，请缩短回答时长后重试")

    temp_input = None
    temp_output = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as source_file:
            source_file.write(raw_bytes)
            temp_input = Path(source_file.name)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as target_file:
            temp_output = Path(target_file.name)

        await asyncio.to_thread(_convert_audio_to_wav, temp_input, temp_output)
        text = await asyncio.to_thread(_transcribe_wav_by_dashscope, temp_output)
        if not text:
            raise HTTPException(status_code=422, detail="未识别到有效语音，请靠近麦克风后重试")
        return TranscribeResponse(text=text)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("voice transcribe failed filename=%s content_type=%s", filename, audio.content_type)
        raise HTTPException(status_code=502, detail=f"语音转写失败：{exc}") from exc
    finally:
        if temp_input and temp_input.exists():
            temp_input.unlink(missing_ok=True)
        if temp_output and temp_output.exists():
            temp_output.unlink(missing_ok=True)


def _build_instruction(profile: PersonaVoiceProfile, style_hint: str | None) -> str:
    parts = [profile.qwen_instruction]
    hint = (style_hint or "").strip()
    if hint:
        parts.append(f"当前语境：{hint}。")
        if "追问" in hint:
            parts.append("请进一步加压提问，语速略快，语气更坚定。")
        elif "开场" in hint:
            parts.append("请保持权威开场，语调沉稳。")
        elif "结束" in hint:
            parts.append("请以面试官口吻做简短收束，语气从容。")
    return "".join(parts)


def _resolve_suffix(filename: str, content_type: str | None) -> str:
    suffix = Path(filename).suffix.lower().strip()
    if suffix:
        return suffix

    content_type = (content_type or "").lower().strip()
    if "webm" in content_type:
        return ".webm"
    if "ogg" in content_type:
        return ".ogg"
    if "mpeg" in content_type or "mp3" in content_type:
        return ".mp3"
    if "wav" in content_type or "wave" in content_type:
        return ".wav"
    if "mp4" in content_type or "m4a" in content_type:
        return ".m4a"
    return ".webm"


def _convert_audio_to_wav(source_path: Path, target_path: Path) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(target_path),
    ]
    process = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if process.returncode != 0:
        message = (process.stderr or process.stdout or "ffmpeg failed").strip()
        raise RuntimeError(message[-500:])


def _get_cached_runtime_key() -> str:
    cached = str(_RUNTIME_KEY_CACHE.get("value") or "").strip()
    expires_at = float(_RUNTIME_KEY_CACHE.get("expires_at") or 0.0)
    if cached and expires_at > time.time():
        return cached
    return ""


def _set_cached_runtime_key(api_key: str) -> None:
    _RUNTIME_KEY_CACHE["value"] = api_key.strip()
    _RUNTIME_KEY_CACHE["expires_at"] = time.time() + VOICE_RUNTIME_CONFIG_TTL_SECONDS


def _extract_runtime_api_key(payload: dict) -> str:
    if not isinstance(payload, dict):
        return ""
    data = payload.get("data")
    if isinstance(data, dict):
        return str(data.get("apiKey") or "").strip()
    return str(payload.get("apiKey") or "").strip()


def _fallback_env_api_key() -> str:
    return (os.getenv("AI_BAILIAN_API_KEY") or "").strip()


def _resolve_runtime_api_key_sync() -> str:
    cached = _get_cached_runtime_key()
    if cached:
        return cached

    if VOICE_RUNTIME_CONFIG_URL and VOICE_RUNTIME_CONFIG_TOKEN:
        try:
            timeout = httpx.Timeout(
                connect=VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS,
                read=VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS,
                write=VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS,
                pool=VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS,
            )
            with httpx.Client(timeout=timeout) as client:
                response = client.get(
                    VOICE_RUNTIME_CONFIG_URL,
                    headers={"X-Internal-Token": VOICE_RUNTIME_CONFIG_TOKEN},
                )
            if response.status_code < 400:
                api_key = _extract_runtime_api_key(response.json())
                if api_key:
                    _set_cached_runtime_key(api_key)
                    return api_key
            else:
                logger.warning("voice runtime key sync failed status=%s", response.status_code)
        except Exception as exc:
            logger.warning("voice runtime key sync failed: %s", str(exc)[:200])

    env_key = _fallback_env_api_key()
    if env_key:
        return env_key
    raise RuntimeError("missing AI_BAILIAN_API_KEY")


async def _resolve_runtime_api_key() -> str:
    cached = _get_cached_runtime_key()
    if cached:
        return cached

    if VOICE_RUNTIME_CONFIG_URL and VOICE_RUNTIME_CONFIG_TOKEN:
        try:
            timeout = httpx.Timeout(
                connect=VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS,
                read=VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS,
                write=VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS,
                pool=VOICE_RUNTIME_CONFIG_TIMEOUT_SECONDS,
            )
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(
                    VOICE_RUNTIME_CONFIG_URL,
                    headers={"X-Internal-Token": VOICE_RUNTIME_CONFIG_TOKEN},
                )
            if response.status_code < 400:
                api_key = _extract_runtime_api_key(response.json())
                if api_key:
                    _set_cached_runtime_key(api_key)
                    return api_key
            else:
                logger.warning("voice runtime key sync failed status=%s", response.status_code)
        except Exception as exc:
            logger.warning("voice runtime key sync failed: %s", str(exc)[:200])

    env_key = _fallback_env_api_key()
    if env_key:
        return env_key
    raise RuntimeError("missing AI_BAILIAN_API_KEY")


def _transcribe_wav_by_dashscope(wav_path: Path) -> str:
    api_key = _resolve_runtime_api_key_sync()

    dashscope.api_key = api_key
    recognition = Recognition(
        model=ASR_MODEL,
        format="wav",
        sample_rate=16000,
        language_hints=["zh", "en"],
        callback=None,
    )
    result = recognition.call(str(wav_path))
    if result.status_code != HTTPStatus.OK:
        raise RuntimeError(getattr(result, "message", "") or "dashscope asr failed")

    sentence = result.get_sentence()
    if isinstance(sentence, dict):
        return (sentence.get("text") or "").strip()
    if isinstance(sentence, list):
        return "".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in sentence
        ).strip()
    return str(sentence or "").strip()


def _parse_dashscope_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
        return payload.get("error", {}).get("message") or payload.get("message") or response.text
    except Exception:
        return response.text


def _extract_dashscope_audio_url(payload: dict) -> str:
    output = payload.get("output") or {}
    audio = output.get("audio") or {}
    return (audio.get("url") or "").strip()


def _extract_dashscope_audio_data(payload: dict) -> bytes:
    output = payload.get("output") or {}
    audio = output.get("audio") or {}
    data = (audio.get("data") or "").strip()
    if not data:
        return b""
    return base64.b64decode(data)


async def _synthesize_by_dashscope(
    *,
    text: str,
    profile: PersonaVoiceProfile,
    style_hint: str | None,
) -> Tuple[bytes, str]:
    api_key = await _resolve_runtime_api_key()

    payload = {
        "model": DASHSCOPE_MODEL,
        "input": {
            "text": text,
            "voice": profile.qwen_voice,
            "language_type": "Chinese",
            "instruction": _build_instruction(profile, style_hint),
        },
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(connect=15.0, read=90.0, write=30.0, pool=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            DASHSCOPE_ENDPOINT,
            headers=headers,
            json=payload,
        )
        if response.status_code >= 400:
            err = _parse_dashscope_error(response)
            logger.warning("dashscope synth failed status=%s err=%s", response.status_code, err[:300])
            raise RuntimeError(err)

        response_json = response.json()
        audio_bytes = _extract_dashscope_audio_data(response_json)
        if audio_bytes:
            return audio_bytes, "audio/wav"

        audio_url = _extract_dashscope_audio_url(response_json)
        if not audio_url:
            raise RuntimeError("dashscope audio url missing")

        audio_response = await client.get(audio_url)
        if audio_response.status_code >= 400:
            raise RuntimeError(f"download dashscope audio failed ({audio_response.status_code})")
        content_type = (audio_response.headers.get("Content-Type") or "audio/wav").split(";")[0].strip()
        return audio_response.content, content_type or "audio/wav"


async def _synthesize_by_edge(*, text: str, voice: str, rate: str, pitch: str) -> bytes:
    communicator = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate=rate,
        pitch=pitch,
    )

    chunks = bytearray()
    async for packet in communicator.stream():
        if packet["type"] == "audio":
            chunks.extend(packet["data"])

    if not chunks:
        raise RuntimeError("empty audio stream")

    return bytes(chunks)
