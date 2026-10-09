"use client";

import { ArrowRight, BookOpen, Check, Compass, Layers3, MapPin, Sparkles, Zap } from "lucide-react";
import type { CSSProperties } from "react";
import { DISTRICTS, ROOMS } from "./game-data";
import type { GameLocation } from "./game-engine";

type UndergroundMapProps = {
  districtIndex: number;
  onSelectDistrict: (index: number) => void;
  onEnterRoom: (index: number) => void;
  onReturnHub: () => void;
  discoveredRooms: number[];
  collectedRooms: number[];
  currentLocation: GameLocation;
  currentRoom: number;
};

function polar(angle: number, radius: number) {
  return {
    left: `${50 + Math.sin(angle) * radius}%`,
    top: `${50 - Math.cos(angle) * radius}%`,
  };
}

export default function UndergroundMap({
  districtIndex,
  onSelectDistrict,
  onEnterRoom,
  onReturnHub,
  discoveredRooms,
  collectedRooms,
  currentLocation,
  currentRoom,
}: UndergroundMapProps) {
  const district = DISTRICTS[districtIndex];
  const localRooms = ROOMS.slice(districtIndex * 10, districtIndex * 10 + 10);
  const found = localRooms.filter((room) => discoveredRooms.includes(room.index)).length;
  const recovered = localRooms.filter((room) => collectedRooms.includes(room.index)).length;
  return (
    <div className="map-workbench atlas-workbench">
      <div className="atlas-stage">
        <div className="atlas-stage-top"><span><Layers3 size={13} /> SUBSURFACE SURVEY / LEVEL −312 M</span><strong>MAP 02 OF 02</strong></div>
        <div className="atlas-radar" aria-label="Map of Lizard Town with 100 selectable rooms">
          <svg className="atlas-rings" viewBox="0 0 500 500" fill="none" aria-hidden="true">
            <circle cx="250" cy="250" r="227" stroke="rgba(165,229,207,.12)" strokeWidth="1" />
            <circle cx="250" cy="250" r="201" stroke="rgba(165,229,207,.18)" strokeWidth="1" strokeDasharray="3 7" />
            <circle cx="250" cy="250" r="177" stroke="rgba(174,224,212,.28)" strokeWidth="1.3" />
            <circle cx="250" cy="250" r="141" stroke="rgba(226,192,137,.30)" strokeWidth="1.3" />
            <circle cx="250" cy="250" r="112" stroke="rgba(165,229,207,.18)" strokeWidth="1" strokeDasharray="5 8" />
            <circle cx="250" cy="250" r="76" stroke="rgba(158,238,212,.27)" strokeWidth="1" />
            {DISTRICTS.map((sector, index) => {
              const angle = (index / 10) * Math.PI * 2;
              const innerX = 250 + Math.sin(angle) * 76;
              const innerY = 250 - Math.cos(angle) * 76;
              const outerX = 250 + Math.sin(angle) * 227;
              const outerY = 250 - Math.cos(angle) * 227;
              return <g key={sector.name}><path d={`M${innerX.toFixed(1)} ${innerY.toFixed(1)} L${outerX.toFixed(1)} ${outerY.toFixed(1)}`} stroke={sector.color} strokeOpacity={index === districtIndex ? 0.62 : 0.18} strokeWidth={index === districtIndex ? 2 : 1} /><circle cx={outerX} cy={outerY} r="2.5" fill={sector.color} fillOpacity={index === districtIndex ? 1 : 0.5} /></g>;
            })}
            <path d="M250 10V40M250 460V490M10 250H40M460 250H490" stroke="rgba(236,208,162,.54)" strokeWidth="1.3" />
            <path d="M250 33L245 42H255L250 33Z" fill="#e5c48e" />
          </svg>
          <div className="atlas-core-ring" />
          <button className="atlas-core" type="button" onClick={onReturnHub} title="Return to Lizard Town"><span className="atlas-core-icon"><Compass size={25} /></span><strong>LIZARD<br />TOWN</strong><small>RETURN TO HUB</small></button>
          {DISTRICTS.map((sector, index) => {
            const angle = (index / 10) * Math.PI * 2;
            const location = polar(angle, 27.5);
            return <button key={sector.name} type="button" className={`atlas-gate ${index === districtIndex ? "atlas-gate-selected" : ""}`} style={{ ...location, "--sector-color": sector.color } as CSSProperties} onClick={() => onSelectDistrict(index)} title={`${sector.name} — rooms ${index * 10 + 1}–${index * 10 + 10}`} aria-label={`View ${sector.name} district`}><span>{String(index + 1).padStart(2, "0")}</span></button>;
          })}
          {ROOMS.map((room) => {
            const lane = room.index % 10 < 5 ? 0 : 1;
            const segment = room.index % 5;
            const angle = (room.districtIndex / 10) * Math.PI * 2 + (segment - 2) * 0.072;
            const location = polar(angle, lane === 0 ? 36 : 42);
            const visited = discoveredRooms.includes(room.index);
            const complete = collectedRooms.includes(room.index);
            return <button key={room.index} type="button" className={`atlas-room-dot ${visited ? "atlas-room-visited" : ""} ${complete ? "atlas-room-complete" : ""} ${currentLocation === "room" && currentRoom === room.index ? "atlas-room-current" : ""}`} style={{ ...location, "--sector-color": room.color } as CSSProperties} onClick={() => onEnterRoom(room.index)} title={`${room.number} · ${room.title} — ${room.gadget}`} aria-label={`Travel to room ${room.number}, ${room.title}`} />;
          })}
          <span className="atlas-north">N <i>↑</i></span>
        </div>
        <div className="atlas-bottom-strip"><span><i className="atlas-key-dot atlas-key-undiscovered" /> UNVISITED</span><span><i className="atlas-key-dot atlas-key-discovered" /> VISITED</span><span><i className="atlas-key-dot atlas-key-complete" /> GADGET RECOVERED</span><strong>100 ROOM NODES LIVE</strong></div>
      </div>
      <aside className="atlas-sidebar" style={{ "--sector-color": district.color } as CSSProperties}>
        <div className="atlas-side-kicker"><span className="tiny-pulse" /> DISTRICT {String(districtIndex + 1).padStart(2, "0")} / 10</div>
        <div className="atlas-side-title"><div><small>UNDERMOUNTAIN SECTOR</small><h3>{district.name}</h3></div><Sparkles size={21} /></div>
        <p>{district.tagline}</p>
        <div className="atlas-side-stats"><span><strong>{String(found).padStart(2, "0")}</strong><small>VISITED</small></span><span><strong>{String(recovered).padStart(2, "0")}</strong><small>GADGETS</small></span><span><strong>10</strong><small>ROOMS</small></span></div>
        <div className="atlas-room-list"><div className="atlas-list-caption"><BookOpen size={12} /> SECTOR ROOM DIRECTORY <span>ENTER ↗</span></div>{localRooms.map((room) => {
          const visited = discoveredRooms.includes(room.index);
          const collected = collectedRooms.includes(room.index);
          return <button type="button" key={room.index} className={`atlas-list-room ${currentLocation === "room" && currentRoom === room.index ? "atlas-list-active" : ""}`} onClick={() => onEnterRoom(room.index)} title={room.description}><span className="atlas-list-number">{room.number}</span><span className="atlas-list-info"><strong>{room.title}</strong><small>{room.gadget}</small></span><span className="atlas-list-state">{collected ? <Check size={12} /> : visited ? <MapPin size={12} /> : <ArrowRight size={12} />}</span></button>;
        })}</div>
        <div className="atlas-side-bottom"><Zap size={13} /> SELECT A ROOM TO OPEN ITS GATE</div>
      </aside>
    </div>
  );
}
