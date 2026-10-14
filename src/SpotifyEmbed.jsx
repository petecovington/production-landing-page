import React, { useEffect, useRef } from 'react';
import * as analytics from './analytics.js';
import { mountSpotifyEmbed } from './spotify-embed.js';

export default function SpotifyEmbed() {
  const host = useRef(null);
  useEffect(() => mountSpotifyEmbed(host.current, { window, document, analytics }), []);
  return <div ref={host} style={{ minHeight: 380 }} />;
}
