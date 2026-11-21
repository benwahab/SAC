type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export default function BrandLogo({ className = "h-9 w-auto", alt = "SAC" }: BrandLogoProps) {
  return (
    <img
      src="/brand/sac-logo.png"
      alt={alt}
      width={800}
      height={392}
      className={className}
      draggable={false}
      decoding="async"
    />
  );
}
