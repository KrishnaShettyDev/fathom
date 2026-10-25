"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sections } from "../lib/navigation";
import { BrandMark, Icon } from "./icon";
import { Dialog } from "./dialog";
import { signOut } from "../lib/auth/actions";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function WorkspaceShell({
  children,
  brands,
  activeBrand,
  email,
}: {
  children: ReactNode;
  brands: { id: string; name: string }[];
  activeBrand: { id: string; name: string } | null;
  email: string;
}) {
  const pathname = usePathname();
  const active = pathname === "/" ? "overview" : pathname.slice(1);
  const label =
    sections.find((section) => section.id === active)?.label ?? "Workspace";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = menuRef.current;
    sidebarRef.current?.querySelector<HTMLElement>("a")?.focus();
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      previous?.focus();
    };
  }, [mobileOpen]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        {mobileOpen ? (
          <button
            className="nav-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
        <aside
          id="workspace-navigation"
          ref={sidebarRef}
          className={`sidebar ${mobileOpen ? "is-open" : ""}`}
          role={mobileOpen ? "dialog" : undefined}
          aria-modal={mobileOpen ? true : undefined}
          aria-label="Workspace navigation"
          onKeyDown={(event) => {
            if (!mobileOpen) return;
            if (event.key === "Escape") {
              event.preventDefault();
              setMobileOpen(false);
            }
            if (event.key !== "Tab") return;
            const elements = sidebarRef.current?.querySelectorAll<HTMLElement>(
              "a[href], button, select",
            );
            const first = elements?.[0];
            const last = elements?.[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
        >
          <button
            className="icon-button mobile-nav-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <Icon name="close" />
          </button>
          <Link
            href="/"
            className="wordmark"
            aria-label="Fathom overview"
            onClick={() => setMobileOpen(false)}
          >
            <BrandMark />
            fathom<span className="wordmark-dot">.</span>
          </Link>
          <div className="workspace-picker">
            <span className="brand-avatar">
              {activeBrand?.name.slice(0, 1).toUpperCase() ?? "f"}
              <span>↗</span>
            </span>
            <div className="workspace-identity">
              <strong>{activeBrand?.name ?? "Create your workspace"}</strong>
              <span>{activeBrand ? "Brand workspace" : "Setup required"}</span>
            </div>
          </div>
          <span className="nav-label">YOUR WORKSPACE</span>
          <nav aria-label="Main navigation">
            {sections.map((section, index) => (
              <div key={section.id}>
                {index === 3 || index === 7 ? (
                  <div className="nav-divider" />
                ) : null}
                <Link
                  href={section.id === "overview" ? "/" : `/${section.id}`}
                  className={`nav-item ${active === section.id ? "active" : ""}`}
                  aria-current={active === section.id ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon name={section.icon} />
                  <span>{section.label}</span>
                </Link>
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="support-note">
              <span className="blue-dot" />
              <p>A little clarity goes a long way.</p>
              <button className="text-button" onClick={() => setHelpOpen(true)}>
                Meet your workspace <Icon name="arrow" size={15} />
              </button>
            </div>
            <button className="profile" onClick={() => setHelpOpen(true)}>
              <span className="avatar">{email.slice(0, 1).toUpperCase()}</span>
              <span>
                {email}
                <small>Signed in</small>
              </span>
              <Icon name="help" size={17} />
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                ref={menuRef}
                aria-controls="workspace-navigation"
                aria-expanded={mobileOpen}
                aria-label="Toggle navigation"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <Icon name="menu" />
              </button>
              <span>Workspace</span>
              <span className="slash">/</span>
              <strong>{label}</strong>
            </div>
            <div className="top-actions">
              <span className="workspace-status">
                <span />
                {activeBrand ? "Workspace ready" : "Setup required"}
              </span>
              <button
                className="icon-button"
                aria-label="Search workspace pages"
                onClick={() => setSearchOpen(true)}
              >
                <Icon name="search" />
              </button>
              <span className="top-avatar">
                {email.slice(0, 1).toUpperCase()}
              </span>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <footer className="app-footer">
            <span>
              <BrandMark /> A clearer path forward.
            </span>
            <span>
              Your accounts. Your data. Your control.
              <span className="footer-separator">/</span>Fathom
            </span>
          </footer>
        </div>
      </div>
      {helpOpen ? (
        <Dialog
          title="A space to see clearly."
          onClose={() => setHelpOpen(false)}
        >
          <p>
            Explore how your brand’s products, search presence, and next
            opportunities come together.
          </p>
          <div className="notice">
            You are signed in as {email}. Your workspace details are stored in
            the database. Source integrations are not enabled yet; no marketing
            measurements are displayed until they can be verified.
          </div>
          {brands.length > 0 ? (
            <WorkspaceSwitcher
              brands={brands}
              activeId={activeBrand?.id ?? ""}
            />
          ) : null}
          <form action={signOut}>
            <button className="button outline" type="submit">
              Sign out
            </button>
          </form>
          <button className="button primary" onClick={() => setHelpOpen(false)}>
            Explore the workspace <Icon name="arrow" />
          </button>
        </Dialog>
      ) : null}
      {searchOpen ? (
        <Dialog
          title="Find your next stop."
          onClose={() => {
            setSearchOpen(false);
            setSearch("");
          }}
        >
          <label className="search-field">
            <Icon name="search" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workspace pages…"
              aria-label="Search pages"
            />
          </label>
          <div className="search-results">
            {sections
              .filter((section) =>
                section.label.toLowerCase().includes(search.toLowerCase()),
              )
              .map((section) => (
                <Link
                  key={section.id}
                  href={section.id === "overview" ? "/" : `/${section.id}`}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearch("");
                  }}
                >
                  <Icon name={section.icon} />
                  {section.label}
                  <Icon name="arrow" />
                </Link>
              ))}
            {sections.every(
              (section) =>
                !section.label.toLowerCase().includes(search.toLowerCase()),
            ) ? (
              <p>No pages match. Try “visibility” or “connections”.</p>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
