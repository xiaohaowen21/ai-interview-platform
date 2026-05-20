import { Marquee } from '../Marquee';
import { Avatar, AvatarFallback, AvatarImage } from './Avatar';
import { Card, CardContent } from './Card';

interface Testimonial {
  name: string;
  username: string;
  body: string;
  img: string;
  country: string;
}

const testimonials: Testimonial[] = [
  {
    name: '小满同学',
    username: '@xiaoman',
    body: '简历分析很细，改完后拿到面试机会明显更多。',
    img: '/avatars/xiaoman.svg',
    country: '🇨🇳 上海',
  },
  {
    name: '阿橙学长',
    username: '@acheng',
    body: '模拟面试的追问很真实，能提前暴露短板。',
    img: '/avatars/acheng.svg',
    country: '🇨🇳 北京',
  },
  {
    name: '晚风学姐',
    username: '@wanfeng',
    body: '知识库问答帮我快速复盘岗位重点，节省了很多时间。',
    img: '/avatars/wanfeng.svg',
    country: '🇨🇳 深圳',
  },
  {
    name: '奶糖同学',
    username: '@naitang',
    body: '界面清爽，历史记录一眼就能看到进步趋势。',
    img: '/avatars/naitang.svg',
    country: '🇨🇳 杭州',
  },
  {
    name: '柚子汽水',
    username: '@youzi',
    body: '从上传到出报告很顺畅，适合集中刷面试。',
    img: '/avatars/youzi.svg',
    country: '🇨🇳 成都',
  },
  {
    name: '北屿同学',
    username: '@beiyu',
    body: '正式面试模式的对话节奏很好，不会冷场。',
    img: '/avatars/beiyu.svg',
    country: '🇨🇳 广州',
  },
  {
    name: '木木学长',
    username: '@mumu',
    body: '手机端也能稳定用，随时练题很方便。',
    img: '/avatars/mumu.svg',
    country: '🇨🇳 南京',
  },
  {
    name: '七七同学',
    username: '@qiqi',
    body: '每次练习都有记录，复盘效率高很多。',
    img: '/avatars/qiqi.svg',
    country: '🇨🇳 武汉',
  },
  {
    name: '星野同学',
    username: '@xingye',
    body: '注册和登录流程都很顺，整体体验很稳定。',
    img: '/avatars/xingye.svg',
    country: '🇨🇳 西安',
  },
];

function TestimonialCard({ img, name, username, body, country }: Testimonial) {
  return (
    <Card className="w-64 shrink-0 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <CardContent>
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9">
            <AvatarImage src={img} alt={username} />
            <AvatarFallback>{name[0]}</AvatarFallback>
          </Avatar>
        <div className="flex flex-col">
            <figcaption className="flex items-center gap-1 text-sm font-medium text-slate-800">
              {name} <span className="text-xs">{country}</span>
            </figcaption>
            <p className="text-xs font-medium text-slate-500">{username}</p>
          </div>
        </div>
        <blockquote className="mt-3 text-sm text-slate-500">{body}</blockquote>
      </CardContent>
    </Card>
  );
}

function Row({ items }: { items: Testimonial[] }) {
  return (
    <div className="flex flex-row gap-4">
      {items.map((review) => (
        <TestimonialCard key={review.username} {...review} />
      ))}
    </div>
  );
}

export default function TestimonialMarquee() {
  const mid = Math.ceil(testimonials.length / 2);
  const rowA = testimonials.slice(0, mid);
  const rowB = testimonials.slice(mid);

  return (
    <div className="relative w-full max-w-6xl overflow-hidden py-4">
      <div className="flex flex-col gap-6 [mask-image:linear-gradient(to_right,transparent,white_8%,white_92%,transparent)]">
        <Marquee pauseOnHover className="[--duration:45s]">
          <Row items={rowA} />
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:45s]">
          <Row items={rowB} />
        </Marquee>
      </div>
    </div>
  );
}
