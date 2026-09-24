import heroImage from "../assets/hero.png";

function ProductCard({ compact = false }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-lg ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="relative flex aspect-[16/10] items-center justify-center rounded-lg border border-gray-700 bg-gray-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.20),transparent_34%),radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.18),transparent_34%)]" />
        <img
          src={heroImage}
          alt="Layered smart home hub"
          className="relative h-28 w-28 object-contain drop-shadow-2xl sm:h-36 sm:w-36"
        />
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">AeroCart Smart Hub</h3>
          <p className="mt-1 text-sm text-gray-400">Express shipping bundle</p>
        </div>
        <p className="text-right text-lg font-black text-white">INR 6,190</p>
      </div>
    </div>
  );
}

export default ProductCard;
