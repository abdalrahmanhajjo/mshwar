"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link2, Lock, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { Avatar } from "@/components/shell/auth-status";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { useGroupCopy } from "@/lib/group-copy";
import {
  GROUP_POLL_MS,
  castVote,
  createShareLink,
  fetchGroupTrip,
  fetchParticipants,
  fetchShareLinks,
  fetchSummary,
  fetchTally,
  lockTrip,
  revokeShareLink,
  type GroupSummary,
  type GroupTrip,
  type ShareLink,
  type VoteTally,
} from "@/lib/groups";

export function GroupTripView({ tripId }: { tripId: string }) {
  const copy = useGroupCopy();
  const [trip, setTrip] = React.useState<GroupTrip | null>(null);
  const [participants, setParticipants] = React.useState<{ display_name: string; role: string }[]>([]);
  const [links, setLinks] = React.useState<ShareLink[]>([]);
  const [tally, setTally] = React.useState<VoteTally | null>(null);
  const [summary, setSummary] = React.useState<GroupSummary | null>(null);
  const [role, setRole] = React.useState("vote");
  const [allowGuest, setAllowGuest] = React.useState(true);
  const [createdPath, setCreatedPath] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const [nextTrip, people, nextTally, nextSummary] = await Promise.all([
      fetchGroupTrip(tripId),
      fetchParticipants(tripId),
      fetchTally(tripId),
      fetchSummary(tripId),
    ]);
    setTrip(nextTrip);
    setParticipants(people.items ?? []);
    setTally(nextTally);
    setSummary(nextSummary);
    if (nextTrip.can_share) {
      setLinks(await fetchShareLinks(tripId));
    }
  }, [tripId]);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchGroupTrip(tripId), fetchParticipants(tripId), fetchTally(tripId), fetchSummary(tripId)])
      .then(async ([nextTrip, people, nextTally, nextSummary]) => {
        if (cancelled) {
          return;
        }
        setTrip(nextTrip);
        setParticipants(people.items ?? []);
        setTally(nextTally);
        setSummary(nextSummary);
        if (nextTrip.can_share) {
          const nextLinks = await fetchShareLinks(tripId);
          if (!cancelled) {
            setLinks(nextLinks);
          }
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });
    const timer = window.setInterval(() => {
      void fetchTally(tripId)
        .then((next) => {
          if (!cancelled) {
            setTally(next);
          }
        })
        .catch(() => undefined);
      void fetchSummary(tripId)
        .then((next) => {
          if (!cancelled) {
            setSummary(next);
          }
        })
        .catch(() => undefined);
    }, GROUP_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tripId]);

  const totalVotes = (item: { yes: number; no: number }) => Math.max(1, item.yes + item.no);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.title}
        icon={<Users aria-hidden />}
        title={trip?.title ?? copy.title}
        description={
          trip?.status === "locked" ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge variant="warning">
                <Lock className="size-3" aria-hidden />
                {copy.lockedBy} {trip.locked_by_name}
              </Badge>
              {trip.locked_at ? <span className="text-sm">{new Date(trip.locked_at).toLocaleString()}</span> : null}
            </span>
          ) : undefined
        }
        actions={
          trip?.can_lock ? (
            <Button type="button" variant="outline" onClick={() => void lockTrip(tripId).then(() => reload())}>
              <Lock aria-hidden />
              {copy.lock}
            </Button>
          ) : null
        }
      />
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.voting}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {(tally?.items ?? []).map((item) => {
                const yesShare = Math.round((item.yes / totalVotes(item)) * 100);
                return (
                  <div
                    key={`${item.kind}-${item.label}`}
                    className="grid gap-3 rounded-control border border-border-subtle p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="grid gap-2">
                      <p className="font-semibold">{item.label}</p>
                      <div className="h-1.5 overflow-hidden rounded-pill bg-danger-subtle" aria-hidden data-rtl-chart>
                        <div className="h-full rounded-pill bg-success" style={{ width: `${yesShare}%` }} />
                      </div>
                      <p className="text-sm text-text-muted">
                        {copy.yes} {item.yes} · {copy.no} {item.no}
                      </p>
                    </div>
                    {trip?.can_vote ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            void castVote(tripId, {
                              experience_id: item.experience_id ?? undefined,
                              term_id: item.term_id ?? undefined,
                              value: 1,
                            }).then(setTally)
                          }
                        >
                          <ThumbsUp aria-hidden />
                          {copy.yes}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void castVote(tripId, {
                              experience_id: item.experience_id ?? undefined,
                              term_id: item.term_id ?? undefined,
                              value: -1,
                            }).then(setTally)
                          }
                        >
                          <ThumbsDown aria-hidden />
                          {copy.no}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.summary}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <section className="grid content-start gap-2 rounded-control bg-success-subtle/60 p-4">
                <h3 className="font-semibold text-success">{copy.agreement}</h3>
                <p>{(summary?.agreement ?? []).map((item) => item.label).join(", ") || "—"}</p>
              </section>
              <section className="grid content-start gap-2 rounded-control bg-danger-subtle/60 p-4">
                <h3 className="font-semibold text-danger">{copy.disagreement}</h3>
                <p>{(summary?.disagreement ?? []).map((item) => item.label).join(", ") || "—"}</p>
              </section>
              <section className="grid content-start gap-2 rounded-control bg-surface-sunken p-4">
                <h3 className="font-semibold">{copy.tradeoffs}</h3>
                <p>{summary?.tradeoffs?.[0]?.note ?? "—"}</p>
              </section>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.participants}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3">
                {participants.map((person) => (
                  <li key={`${person.display_name}-${person.role}`} className="flex items-center gap-3 text-sm">
                    <Avatar name={person.display_name} className="size-9 text-xs" />
                    <span className="font-medium">{person.display_name}</span>
                    <Badge variant="outline" className="ms-auto">
                      {person.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {trip?.can_share ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{copy.share}</CardTitle>
                <CardDescription>{copy.joinHint}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className="grid gap-2 text-sm font-medium">
                  Role
                  <NativeSelect aria-label="share role" value={role} onChange={(event) => setRole(event.target.value)}>
                    <option value="view">view</option>
                    <option value="vote">vote</option>
                    <option value="edit">edit</option>
                  </NativeSelect>
                </label>
                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={allowGuest}
                    onChange={(event) => setAllowGuest(event.target.checked)}
                  />
                  {copy.allowGuest}
                </label>
                <Button
                  type="button"
                  onClick={() =>
                    void createShareLink(tripId, role, allowGuest)
                      .then((link) => {
                        setCreatedPath(link.join_path ?? null);
                        return reload();
                      })
                      .catch((err: Error) => setError(err.message))
                  }
                >
                  <Link2 aria-hidden />
                  {copy.createLink}
                </Button>
                {createdPath ? (
                  <p className="break-all rounded-control bg-surface-sunken px-3.5 py-2.5 font-mono text-xs">
                    {createdPath}
                  </p>
                ) : null}
                <ul className="grid gap-2">
                  {links.map((link) => (
                    <li
                      key={link.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle px-3.5 py-2.5 text-sm"
                    >
                      <span>
                        {link.role} {link.allow_guest ? "· guest" : ""} {link.revoked_at ? `· ${copy.revoked}` : ""}
                      </span>
                      {link.revoked_at ? null : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void revokeShareLink(link.id).then(reload)}
                        >
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function JoinTripView({ token }: { token: string }) {
  const copy = useGroupCopy();
  const [name, setName] = React.useState("Guest");
  const [tripId, setTripId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (tripId) {
    return <GroupTripView tripId={tripId} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-lg gap-6 rounded-[1.75rem] border border-border-subtle bg-surface-raised p-7 shadow-lg md:p-10">
      <span className="grid size-12 place-items-center rounded-full bg-brand-subtle">
        <Users className="size-5" aria-hidden />
      </span>
      <div className="grid gap-2">
        <h1 className="title-page text-[2.4rem]">{copy.join}</h1>
        <p className="text-sm text-text-muted">{copy.joinHint}</p>
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <label className="grid gap-2 text-sm font-medium">
        {copy.displayName}
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <Button
        type="button"
        size="lg"
        onClick={() =>
          void import("@/lib/groups")
            .then(({ joinShare }) => joinShare(token, name))
            .then((joined) => setTripId(joined.trip_id))
            .catch((err: Error) => setError(err.message))
        }
      >
        {copy.guestJoin}
      </Button>
    </div>
  );
}
