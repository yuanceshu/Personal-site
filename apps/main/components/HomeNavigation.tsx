"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type HomeNavigationGroup = {
  id: string;
  label: string;
  title: string;
  links: { label: string; href: string; external?: boolean }[];
};

export function HomeNavigation({ groups }: { groups: HomeNavigationGroup[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !navigation.current?.contains(event.target)) {
        setOpenId(null);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <nav className="home-navigation" aria-label="主要导航" ref={navigation}>
      {groups.map((group) => {
        const open = openId === group.id;
        const panelId = `home-navigation-${group.id}`;
        return (
          <div
            className="home-navigation__item"
            key={group.id}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setOpenId(group.id);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setOpenId(null);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOpenId(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                event.preventDefault();
                setOpenId(null);
                event.currentTarget.querySelector("button")?.focus();
              }
            }}
          >
            <button
              type="button"
              className="home-navigation__trigger"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : group.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpenId(group.id);
                  requestAnimationFrame(() => {
                    document.getElementById(panelId)?.querySelector("a")?.focus();
                  });
                }
              }}
            >
              {group.label}
            </button>
            <div className="home-navigation__dropdown" id={panelId} hidden={!open}>
              <p className="home-navigation__title">{group.title}</p>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      referrerPolicy={link.external ? "no-referrer" : undefined}
                      onClick={() => setOpenId(null)}
                    >
                      {link.label}<span aria-hidden="true">↗</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
