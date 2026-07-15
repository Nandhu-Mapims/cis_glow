import { useMemo, useState } from 'react';

const AVATAR_TONES = [
  { bg: '#a61a1a', fg: '#fff7f5' },
  { bg: '#8b4513', fg: '#fff8f0' },
  { bg: '#0f766e', fg: '#ecfeff' },
  { bg: '#1d4ed8', fg: '#eff6ff' },
  { bg: '#6d28d9', fg: '#f5f3ff' },
  { bg: '#b45309', fg: '#fffbeb' },
  { bg: '#be123c', fg: '#fff1f2' },
  { bg: '#334155', fg: '#f8fafc' },
];

function getInitials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function toneForName(name = '') {
  const text = String(name || 'user');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export default function UserAvatar({
  name = '',
  photoUrl = '',
  className = '',
  size = 36,
}) {
  const [failed, setFailed] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const tone = useMemo(() => toneForName(name), [name]);
  const showPhoto = Boolean(photoUrl) && !failed;

  if (showPhoto) {
    return (
      <span
        className={`cis-user-avatar cis-user-avatar-photo ${className}`.trim()}
        style={{ width: size, height: size }}
      >
        <img
          src={photoUrl}
          alt=""
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`cis-user-avatar cis-user-avatar-initials ${className}`.trim()}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${tone.bg} 0%, color-mix(in srgb, ${tone.bg} 72%, #111) 100%)`,
        color: tone.fg,
        fontSize: Math.max(11, Math.round(size * 0.34)),
      }}
      aria-hidden="true"
      title={name || 'User'}
    >
      {initials}
    </span>
  );
}
