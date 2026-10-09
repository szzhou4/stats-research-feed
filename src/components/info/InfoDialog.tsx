"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const STATS_LAB_URL = "https://www.statslabatcmc.com";
const OPENALEX_URL = "https://openalex.org";
const OPENALEX_DOCS_URL = "https://docs.openalex.org";

interface InfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-secondary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

export function InfoDialog({ open, onOpenChange }: InfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>About this feed</DialogTitle>
          <DialogDescription>
            Where the articles come from, how they get here, and what is stored about you.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-5">
          <Section title="Where the data comes from">
            <p>
              Every article is pulled live from{" "}
              <TextLink href={OPENALEX_URL}>OpenAlex</TextLink>, a free and open catalog of the
              world&apos;s scholarly literature maintained by the non-profit OurResearch. It indexes
              works, authors, and journals across essentially all of academic publishing, and is the
              successor to Microsoft Academic Graph.
            </p>
            <p>
              This app talks to the public OpenAlex REST API at{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">api.openalex.org</code> (
              <TextLink href={OPENALEX_DOCS_URL}>documentation</TextLink>). Nothing is scraped from
              publisher sites, and no other data source is involved.
            </p>
          </Section>

          <Section title="Does it cost anything?">
            <p>
              <span className="font-medium text-foreground">Not for you.</span> OpenAlex data is
              free and open, and this app uses it without an API key, an account, or any payment.
              Every request it makes is read-only and anonymous.
            </p>
            <p>
              OpenAlex does meter API usage as a small daily budget. Keyless access, which is what
              this app uses, is about $0.10 of usage per day — roughly 1,000 list queries. A free
              API key raises that tenfold, and paid plans raise it further. The ceiling on request
              rate is 100 per second.
            </p>
            <p>
              Normal use sits far below that budget. Loading a 26-journal watchlist from cold costs
              only a handful of requests, because journal lookups are cached for 24 hours, results
              for 20 minutes, and many journals are combined into one call rather than queried
              separately. Revisiting within 20 minutes costs nothing at all.
            </p>
          </Section>

          <Section title="How the feed is built">
            <p>When you load the page, the app:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Matches each journal on your watchlist to its OpenAlex source record by ISSN, the
                stable identifier OpenAlex recommends over title matching.
              </li>
              <li>
                Requests works published in those journals in the last{" "}
                <span className="font-medium text-foreground">90 days</span>, batching up to 40
                journals per request and sorting newest first.
              </li>
              <li>
                Keeps only items OpenAlex classifies as research articles or reviews, and drops
                anything flagged as retracted. Errata, corrections, editorials, and letters are
                filtered out before they reach you.
              </li>
              <li>
                Reconstructs each abstract from OpenAlex&apos;s inverted index, removes duplicate
                records, and groups the result by recency.
              </li>
            </ol>
            <p>
              Open Access badges come from OpenAlex&apos;s own open-access status for each work. If
              OpenAlex cannot be reached, the app falls back to a small built-in sample so the
              interface still works, and tells you it is doing so.
            </p>
          </Section>

          <Section title="What is stored about you">
            <p>
              There is no account and no database behind this app. Your journal watchlist, the
              articles you have marked seen, your saved articles, when you last visited, and the
              cached results all live in this browser&apos;s local storage. None of it is sent to
              the STATS Lab, and the app contains no analytics, tracking scripts, or third-party
              embeds.
            </p>
            <p>
              <span className="font-medium text-foreground">What does leave your browser:</span>{" "}
              requests to OpenAlex. Those are the only automatic outbound calls the app makes, and
              they necessarily show OpenAlex your IP address and which journals you follow, since
              the journal identifiers are part of the query.
            </p>
            <p>
              <span className="font-medium text-foreground">What never leaves:</span> your search
              terms, which articles you marked seen, and your saved list. Searching and filtering
              happen locally over articles already downloaded, so nothing you type is transmitted
              anywhere. Opening an article is an ordinary link out to the publisher, visible to them
              like any other visit.
            </p>
            <p>
              Clearing your browser data for this site resets the feed to a blank slate, and your
              history will not follow you to another browser or device.
            </p>
          </Section>

          <Section title="Known limits">
            <ul className="list-disc space-y-1 pl-5">
              <li>Only the last 90 days of publications are shown.</li>
              <li>
                A journal appears only if OpenAlex can match it; unmatched journals stay on your
                list but are flagged in Manage journals.
              </li>
              <li>
                Dates are OpenAlex publication dates, which may differ from a journal&apos;s own
                online-first date.
              </li>
              <li>
                Because results are cached for 20 minutes, a brand-new article may take that long to
                appear.
              </li>
            </ul>
          </Section>

          <Section title="Who made this">
            <p>
              Built by the <span className="font-medium text-foreground">STATS Lab</span> at
              Claremont McKenna College, which works on organizational and quantitative psychology,
              psychometrics, and research methods.
            </p>
          </Section>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" asChild>
            <a href={STATS_LAB_URL} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              More about the STATS Lab
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
