-- 原子化多维度限流脚本
-- 基于滑动时间窗口实现的多维度原子限流
-- 只有所有维度都满足条件时才扣减令牌，确保原子性

-- 参数说明：
-- KEYS[1..N]: 限流维度键列表
-- ARGV[1]: 当前时间戳（毫秒）
-- ARGV[2]: 申请令牌数
-- ARGV[3]: 时间窗口（毫秒）
-- ARGV[4]: 最大令牌数（窗口内允许的总数）
-- ARGV[5]: 请求唯一标识

local now_ms = tonumber(ARGV[1])
local permits = tonumber(ARGV[2])
local interval = tonumber(ARGV[3])
local max_tokens = tonumber(ARGV[4])
local request_id = ARGV[5]

-- 第一阶段：预检查阶段 - 检查所有维度是否有足够令牌
for i, key in ipairs(KEYS) do
    local value_key = key .. ":value"
    local permits_key = key .. ":permits"

    -- 初始化 value_key（如果不存在）
    if redis.call("exists", value_key) == 0 then
        redis.call("set", value_key, max_tokens)
    end

    -- 回收过期令牌
    -- 清理过期的 permit 记录，并回收配额到 value_key
    local expired_values = redis.call("zrangebyscore", permits_key, 0, now_ms - interval)
    if #expired_values > 0 then
        local expired_count = 0
        for _, v in ipairs(expired_values) do
            -- 优化解析逻辑：使用更高效的模式匹配
            local p = tonumber(string.match(v, ":(%d+)$"))
            if p then
                expired_count = expired_count + p
            end
        end

        -- 删除过期记录
        redis.call("zremrangebyscore", permits_key, 0, now_ms - interval)

        -- 回收配额
        if expired_count > 0 then
            local curr_v = tonumber(redis.call("get", value_key) or max_tokens)
            local next_v = math.min(max_tokens, curr_v + expired_count)
            redis.call("set", value_key, next_v)
        end
    end

    -- 核心检查：当前可用令牌是否足够
    local current_val = tonumber(redis.call("get", value_key) or max_tokens)
    if current_val < permits then
        -- 任何一个维度配额不足，直接返回失败
        return 0
    end
end

-- 第二阶段：扣减阶段 - 只有所有维度都通过后才执行
for i, key in ipairs(KEYS) do
    local value_key = key .. ":value"
    local permits_key = key .. ":permits"

    -- 记录本次令牌分配（格式：request_id:permits）
    local permit_record = request_id .. ":" .. permits
    redis.call("zadd", permits_key, now_ms, permit_record)

    -- 扣减令牌
    local current_v = tonumber(redis.call("get", value_key) or max_tokens)
    redis.call("set", value_key, current_v - permits)

    -- 设置过期时间，确保过期令牌能被正常回收 (窗口的2倍，至少1秒)
    local expire_time = math.ceil(interval * 2 / 1000)
    if expire_time < 1 then expire_time = 1 end
    redis.call("expire", value_key, expire_time)
    redis.call("expire", permits_key, expire_time)
end

-- 成功获取所有维度的令牌
return 1
