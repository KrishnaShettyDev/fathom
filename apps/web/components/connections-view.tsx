"use client";
import { useState } from "react";
import { PageHeading } from "./shared";
import { Dialog } from "./dialog";
import { Icon } from "./icon";
const integrations = [
  {
    name: "Shopify",
    mark: "S",
    category: "COMMERCE",
    description: "Import products, variants and collections from your store.",
    requirements:
      "An authorized Shopify app installation with read-only catalogue permissions. Credentials and sync jobs must be isolated to this brand.",
    data: "Products · Variants · Collections",
  },
  {
    name: "Google Search Console",
    mark: "G",
    category: "OWNED SEARCH",
    description:
      "Understand the queries and pages that bring visitors to your website.",
    requirements:
      "An authorized Google account and explicit Search Console property selection. The app must verify permission for that exact property.",
    data: "Queries · Pages · Search performance",
  },
  {
    name: "Google Analytics",
    mark: "▥",
    category: "WEBSITE OUTCOMES",
    description: "Connect your website traffic and recorded outcomes.",
    requirements:
      "An authorized GA4 property, explicit property selection and a tracking/consent review.",
    data: "Traffic · Events · Website outcomes",
  },
  {
    name: "AI observations",
    mark: "✳",
    category: "DISCOVERY",
    description:
      "Collect a defined set of answers with inspectable source evidence.",
    requirements:
      "A permitted provider, documented collection method, an agreed question set and a collection budget. API observations remain distinct from consumer-interface observations.",
    data: "Answers · Mentions · Citations",
  },
];
export function ConnectionsView({ brandName }: { brandName: string }) {
  const [selected, setSelected] = useState<
    (typeof integrations)[number] | null
  >(null);
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="BUILD YOUR CONNECTED PICTURE"
        title="Better context."
        accent="Starts here."
        description={`Review the sources for ${brandName}. Integration authorization is not enabled yet.`}
      />
      <div className="connection-banner">
        <span className="connection-orbit">
          <Icon name="link" size={25} />
        </span>
        <div>
          <h2>Your accounts. Your control.</h2>
          <p>
            Your workspace is saved. Secure store connection and synchronization
            are next.
          </p>
        </div>
      </div>
      <div className="connections-grid">
        {integrations.map((integration) => (
          <article className="connection-card" key={integration.name}>
            <div className="connection-card-top">
              <span className="connection-logo">{integration.mark}</span>
              <span className="disconnected">
                <i />
                Setup not available yet
              </span>
            </div>
            <span className="eyebrow">{integration.category}</span>
            <h2>{integration.name}</h2>
            <p>{integration.description}</p>
            <small>{integration.data}</small>
            <button
              className="button outline"
              onClick={() => setSelected(integration)}
            >
              View requirements
              <Icon name="arrow" size={16} />
            </button>
          </article>
        ))}
      </div>
      {selected ? (
        <Dialog
          title={`${selected.name} requirements`}
          onClose={() => setSelected(null)}
        >
          <p>
            <strong>Brand: {brandName}</strong>
          </p>
          <p>{selected.requirements}</p>
          <div className="notice">
            This connector is not implemented yet. No authorization, account
            discovery or synchronization is performed by this screen. Do not
            paste credentials here.
          </div>
          <button className="button primary" onClick={() => setSelected(null)}>
            Understood
            <Icon name="check" size={16} />
          </button>
        </Dialog>
      ) : null}
    </div>
  );
}
