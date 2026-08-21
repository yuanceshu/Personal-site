import Image from "next/image";

type PublicAccountCardProps = {
  compact?: boolean;
};

export function PublicAccountCard({ compact = false }: PublicAccountCardProps) {
  return (
    <aside className={`public-account ${compact ? "public-account--compact" : ""}`} aria-labelledby="public-account-title">
      <div className="public-account__copy">
        <p className="eyebrow">继续同行</p>
        <h3 id="public-account-title">小袁AI感雾</h3>
        <p>
          不定期分享 AI 产品实践、学习心得与生活感悟。不追光，只生长。
        </p>
        <span>微信扫一扫，关注公众号</span>
      </div>
      <Image
        className="public-account__qr"
        src="/profile/wechat-official-account-qr.png"
        alt="小袁AI感雾公众号二维码"
        width={compact ? 144 : 188}
        height={compact ? 144 : 188}
      />
    </aside>
  );
}
