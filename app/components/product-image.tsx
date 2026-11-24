import Image from "next/image";
import { getProductImageSrc } from "@/lib/product-images";

type ProductImageProps = {
  imageKey: string;
  category: string;
  name: string;
  className?: string;
  sizes?: string;
  preload?: boolean;
  /** Chất lượng nén; ảnh trong danh sách dùng mức thấp hơn ảnh hero/chi tiết. */
  quality?: number;
  /** Tắt nhãn phủ ảnh khi ảnh được dùng làm thumbnail nhỏ. */
  showIllustrationBadge?: boolean;
};

export default function ProductImage({
  imageKey,
  category,
  name,
  className = "",
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  preload = false,
  quality = 80,
  showIllustrationBadge = true,
}: ProductImageProps) {
  return (
    <div className={`group/image relative overflow-hidden bg-stone-100 ${className}`}>
      <Image
        src={getProductImageSrc(imageKey, category)}
        alt={`Ảnh minh họa không gian cho ${name}`}
        fill
        sizes={sizes}
        quality={quality}
        preload={preload}
        className="object-cover transition duration-700 group-hover/image:scale-[1.04]"
      />
      {showIllustrationBadge && (
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600 shadow-sm backdrop-blur">
          Ảnh minh họa
        </span>
      )}
    </div>
  );
}
