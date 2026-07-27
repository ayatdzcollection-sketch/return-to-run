// Where to put the watch.
//
// This is not decoration. Moving the sensor off the wrist bone and onto the
// forearm muscle cut heart-rate error roughly in half during treadmill running
// (MAPE 5.95% to 1.89%), which is a bigger improvement than any threshold in
// this app. The reason is prosaic: the wrist is tendons and bone with the
// sensor sliding over them, and two inches up is muscle that moves with it.
//
// A sentence describing "two or three finger-widths proximal" was not landing,
// so the instruction is shown as a wrong-versus-right pair. Position is much
// easier to copy than to read.

export function WatchPlacement() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Arm correct={false} />
        <Arm correct />
      </div>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-stone-400">
        Slide it up until it sits on the soft muscle, not on the knobbly wrist bone.
        Roughly <strong className="text-stone-200">two fingers</strong> above where you would
        normally wear it. Snug enough that it does not slide when you shake your arm,
        loose enough that it is not leaving a mark.
      </p>
    </div>
  )
}

function Arm({ correct }: { correct: boolean }) {
  const accent = correct ? '#fb923c' : '#57534e'
  return (
    <figure className="m-0">
      <svg viewBox="0 0 120 170" className="w-full" role="img"
        aria-label={correct ? 'Watch worn on the forearm, above the wrist bone' : 'Watch worn on the wrist bone'}>
        {/* forearm, wrist, hand: drawn vertically so it reads at thumbnail size */}
        <path
          d="M38 8 L82 8 L86 78 Q86 92 78 100 L78 128 Q78 152 60 158 Q42 152 42 128 L42 100 Q34 92 34 78 Z"
          fill="#1c1917" stroke="#44403c" strokeWidth="2"
        />
        {/* the wrist bone: the landmark he can actually feel */}
        <circle cx="78" cy="99" r="5.5" fill="#292524" stroke="#57534e" strokeWidth="1.5" />
        <text x="94" y="103" fontSize="9" fill="#78716c" fontFamily="Inter, sans-serif">bone</text>

        {/* watch band, at the wrist or two fingers up it */}
        <g transform={`translate(0, ${correct ? 0 : 30})`}>
          <rect x="30" y="56" width="60" height="15" rx="4" fill={accent} opacity="0.28" />
          <rect x="38" y="49" width="44" height="29" rx="7" fill="#0c0a09" stroke={accent} strokeWidth="2.5" />
          <circle cx="60" cy="63.5" r="6" fill={accent} opacity="0.55" />
        </g>

        {correct && (
          <g stroke="#fb923c" strokeWidth="1.5" fill="none">
            <path d="M60 88 L60 78" markerEnd="" />
            <path d="M56 82 L60 78 L64 82" />
          </g>
        )}
      </svg>
      <figcaption
        className={`mt-1.5 text-center text-xs font-semibold uppercase tracking-widest ${
          correct ? 'text-ceiling' : 'text-stone-600'
        }`}
      >
        {correct ? 'here' : 'not here'}
      </figcaption>
    </figure>
  )
}
