import React, { useState, useEffect } from 'react';
import { theme } from '../../theme';

export interface PerelandraGlobeProps {
  width: number;
  height: number;
}

const RADIUS = 8;
const WIDTH = RADIUS * 4;
const HEIGHT = RADIUS * 2 + 1;

interface Island {
  theta: number; // longitude (0 to 2π)
  phi: number;   // latitude (-π/2 to π/2)
  char: string;
}

const ISLANDS: Island[] = [
  { theta: 0, phi: 0.3, char: '🌴' },
  { theta: Math.PI * 0.4, phi: -0.2, char: '🌿' },
  { theta: Math.PI * 0.8, phi: 0.5, char: '🏝️' },
  { theta: Math.PI * 1.2, phi: -0.4, char: '🌱' },
  { theta: Math.PI * 1.6, phi: 0.1, char: '🌳' },
];

const WAVE_CHARS = ['░', '▒', '≈', '~', '∿', '≋'];

function generateGlobeFrame(rotation: number, wavePhase: number): string[] {
  const grid: string[][] = [];
  
  for (let y = 0; y < HEIGHT; y++) {
    grid[y] = [];
    for (let x = 0; x < WIDTH; x++) {
      grid[y][x] = ' ';
    }
  }

  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = (x - centerX) / (RADIUS * 2);
      const dy = (y - centerY) / RADIUS;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 1.0) {
        const z = Math.sqrt(1 - dist * dist);
        const longitude = Math.atan2(dx, z) + rotation;
        const latitude = Math.asin(dy);
        
        const waveIndex = Math.floor(
          (Math.sin(longitude * 3 + wavePhase) * 0.5 + 0.5 +
           Math.sin(latitude * 4 + wavePhase * 0.7) * 0.3) * 
          (WAVE_CHARS.length - 1)
        );
        
        grid[y][x] = WAVE_CHARS[Math.max(0, Math.min(waveIndex, WAVE_CHARS.length - 1))];
      }
    }
  }

  for (const island of ISLANDS) {
    const adjustedTheta = island.theta + rotation;
    const cosTheta = Math.cos(adjustedTheta);
    
    if (cosTheta > 0) {
      const projX = Math.sin(adjustedTheta) * Math.cos(island.phi);
      const projY = Math.sin(island.phi);
      
      const screenX = Math.round(centerX + projX * RADIUS * 2);
      const screenY = Math.round(centerY + projY * RADIUS);
      
      if (screenX >= 0 && screenX < WIDTH && screenY >= 0 && screenY < HEIGHT) {
        grid[screenY][screenX] = island.char;
      }
    }
  }

  const lines: string[] = [];
  
  lines.push('         ╭' + '─'.repeat(WIDTH) + '╮');
  
  for (let y = 0; y < HEIGHT; y++) {
    const dy = (y - centerY) / RADIUS;
    const absDy = Math.abs(dy);
    
    let leftEdge = '│';
    let rightEdge = '│';
    
    if (y === 0) {
      leftEdge = '╭';
      rightEdge = '╮';
    } else if (y === HEIGHT - 1) {
      leftEdge = '╰';
      rightEdge = '╯';
    } else if (absDy > 0.8) {
      leftEdge = '│';
      rightEdge = '│';
    }
    
    const rowContent = grid[y].join('');
    
    if (y === 0) {
      const sphereWidth = Math.round(Math.sqrt(1 - dy * dy) * RADIUS * 2);
      const padding = Math.round((WIDTH - sphereWidth) / 2);
      lines.push('       ╭─' + '─'.repeat(Math.max(0, sphereWidth)) + '─╮');
    } else if (y === HEIGHT - 1) {
      const sphereWidth = Math.round(Math.sqrt(1 - dy * dy) * RADIUS * 2);
      lines.push('       ╰─' + '─'.repeat(Math.max(0, sphereWidth)) + '─╯');
    } else {
      lines.push('       │ ' + rowContent + ' │');
    }
  }
  
  return lines;
}

function generateSphereFrame(rotation: number, wavePhase: number): string[] {
  const R = 9;
  const lines: string[] = [];
  
  for (let y = -R; y <= R; y++) {
    let row = '';
    const yNorm = y / R;
    const sliceRadius = Math.sqrt(1 - yNorm * yNorm);
    const sliceWidth = Math.round(sliceRadius * R * 2);
    
    for (let x = -R * 2; x <= R * 2; x++) {
      const xNorm = x / (R * 2);
      const dist = Math.sqrt(xNorm * xNorm + yNorm * yNorm);
      
      if (dist <= 1.0) {
        const z = Math.sqrt(Math.max(0, 1 - xNorm * xNorm - yNorm * yNorm));
        const lon = Math.atan2(xNorm, z) + rotation;
        const lat = Math.asin(yNorm);
        
        let char = ' ';
        
        let isIsland = false;
        for (const island of ISLANDS) {
          const adjustedTheta = island.theta + rotation;
          const cosTheta = Math.cos(adjustedTheta);
          
          if (cosTheta > 0.1) {
            const projX = Math.sin(adjustedTheta) * Math.cos(island.phi);
            const projY = Math.sin(island.phi);
            
            const islandDist = Math.sqrt(
              Math.pow(xNorm - projX, 2) + 
              Math.pow(yNorm - projY, 2)
            );
            
            if (islandDist < 0.12) {
              char = island.char;
              isIsland = true;
              break;
            }
          }
        }
        
        if (!isIsland) {
          const wave1 = Math.sin(lon * 4 + wavePhase);
          const wave2 = Math.sin(lat * 5 + wavePhase * 1.3);
          const wave3 = Math.sin((lon + lat) * 3 + wavePhase * 0.7);
          const combined = (wave1 + wave2 + wave3) / 3;
          
          const edgeFade = 1 - Math.pow(dist, 3);
          const intensity = (combined * 0.5 + 0.5) * edgeFade;
          
          if (intensity > 0.7) char = '≋';
          else if (intensity > 0.5) char = '≈';
          else if (intensity > 0.35) char = '∿';
          else if (intensity > 0.2) char = '~';
          else if (intensity > 0.1) char = '·';
          else char = ' ';
        }
        
        row += char;
      } else {
        row += ' ';
      }
    }
    
    lines.push(row);
  }
  
  return lines;
}

export function PerelandraGlobe({ width, height }: PerelandraGlobeProps): React.ReactNode {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => f + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const rotation = (frame * 0.05) % (Math.PI * 2);
  const wavePhase = frame * 0.15;
  
  const globeLines = generateSphereFrame(rotation, wavePhase);
  
  const globeHeight = globeLines.length;
  const globeWidth = Math.max(...globeLines.map((l) => l.length));
  
  const paddingTop = Math.max(0, Math.floor((height - globeHeight - 3) / 2));
  const paddingLeft = Math.max(0, Math.floor((width - globeWidth) / 2));

  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        paddingTop,
      }}
    >
      <text fg={theme.palette.lavender} style={{ marginBottom: 1, paddingLeft }}>
        {'✧ Venus / Perelandra ✧'}
      </text>
      {globeLines.map((line, idx) => (
        <text key={idx} fg={theme.palette.teal} style={{ paddingLeft }}>
          {line}
        </text>
      ))}
      <text fg={theme.textMuted} style={{ marginTop: 1, paddingLeft }}>
        {'~ the floating world ~'}
      </text>
    </box>
  );
}
