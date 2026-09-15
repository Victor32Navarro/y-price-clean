/**
 * components/AdSlot.jsx — rezervovaná reklamní pozice
 * ---------------------------------------------------------------------------
 * Účel: mít v layoutu od začátku pevně vyhrazené, responzivní místo pro
 * reklamu (leaderboard nahoře, native in-feed mezi kartami, sidebar na
 * desktopu), aby pozdější zapojení AdSense/Ezoic/přímých kampaní neposunulo
 * celý layout. Dokud je `slot` prázdný, zobrazí se jen tichý placeholder
 * v barvách webu — ne rozbitá díra ani cizí bílý rámeček.
 *
 * Použití:
 *   <AdSlot format="leaderboard" />   // 728×90 desktop / 320×50 mobile
 *   <AdSlot format="in-feed" />       // mezi kartami výsledků
 *   <AdSlot format="sidebar" />       // 300×250, jen desktop (lg:block)
 */

const FORMAT_STYLES = {
  leaderboard: 'h-[50px] sm:h-[90px] w-full max-w-[970px] mx-auto',
  'in-feed': 'h-24 w-full',
  sidebar: 'hidden lg:block h-[250px] w-[300px]',
};

export default function AdSlot({ format = 'in-feed', slot = null, className = '' }) {
  const sizeClasses = FORMAT_STYLES[format] || FORMAT_STYLES['in-feed'];

  return (
    <div
      className={`${sizeClasses} ${className} rounded-xl border border-line
                  bg-card/40 flex items-center justify-center overflow-hidden`}
      data-ad-format={format}
      aria-label="Reklamní prostor"
    >
      {slot ? (
        // Sem přijde skutečný ad kód/iframe od zvoleného poskytovatele.
        slot
      ) : (
        <span className="text-[11px] text-neutral-600 tracking-wide">
          Reklamní prostor · {format}
        </span>
      )}
    </div>
  );
}
