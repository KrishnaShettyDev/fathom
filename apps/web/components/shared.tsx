import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export function PageHeading({
  eyebrow,
  title,
  accent,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="blue-dot" />
          {eyebrow}
        </div>
        <h1>
          {title} <em>{accent}</em>
        </h1>
        <p>{description}</p>
      </div>
      {children ? <div className="heading-actions">{children}</div> : null}
    </div>
  );
}
export function EmptyState({
  title = "Your story starts with a connection.",
  description = "Connect your store and data sources to build a baseline for your brand.",
  icon = "signal",
}: {
  title?: string;
  description?: string;
  icon?: IconName;
}) {
  return (
    <section className="empty-state">
      <div className="empty-art">
        <Icon name={icon} size={38} />
      </div>
      <span className="eyebrow">A CLEARER PICTURE, SOON</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link href="/connections" className="button primary">
        Explore connections <Icon name="arrow" />
      </Link>
      <small>
        No observations yet. Unavailable data is never counted as zero.
      </small>
    </section>
  );
}
export function SectionTitle({
  title,
  note,
  href,
  action,
}: {
  title: string;
  note?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {note ? <p>{note}</p> : null}
      </div>
      {href ? (
        <Link className="text-button" href={href}>
          {action ?? "View all"}
          <Icon name="arrow" size={16} />
        </Link>
      ) : null}
    </div>
  );
}
