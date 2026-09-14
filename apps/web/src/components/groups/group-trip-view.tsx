"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-text-muted">{copy.title}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{trip?.title ?? copy.title}</h1>
        {trip?.status === "locked" ? (
          <p className="mt-2 text-sm text-text-muted">
            {copy.lockedBy} {trip.locked_by_name}{" "}
            {trip.locked_at ? `· ${new Date(trip.locked_at).toLocaleString()}` : ""}
          </p>
        ) : null}
      </header>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {trip?.can_share ? (
        <Card>
          <CardHeader>
            <CardTitle>{copy.share}</CardTitle>
            <CardDescription>{copy.joinHint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Role
              <select
                aria-label="share role"
                className="rounded-control border border-border bg-surface-raised px-3 py-2"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="view">view</option>
                <option value="vote">vote</option>
                <option value="edit">edit</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowGuest} onChange={(event) => setAllowGuest(event.target.checked)} />
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
              {copy.createLink}
            </Button>
            {createdPath ? <p className="text-sm text-text-muted">{createdPath}</p> : null}
            <ul className="grid gap-2">
              {links.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {link.role} {link.allow_guest ? "· guest" : ""} {link.revoked_at ? `· ${copy.revoked}` : ""}
                  </span>
                  {link.revoked_at ? null : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
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

      <Card>
        <CardHeader>
          <CardTitle>{copy.participants}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2">
            {participants.map((person) => (
              <li key={`${person.display_name}-${person.role}`} className="text-sm">
                {person.display_name} · {person.role}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.voting}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(tally?.items ?? []).map((item) => (
            <div key={`${item.kind}-${item.label}`} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{item.label}</p>
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
                    {copy.no}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {trip?.can_lock ? (
            <Button type="button" variant="outline" onClick={() => void lockTrip(tripId).then(() => reload())}>
              {copy.lock}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.summary}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <section>
            <h3 className="font-medium">{copy.agreement}</h3>
            <p>{(summary?.agreement ?? []).map((item) => item.label).join(", ") || "—"}</p>
          </section>
          <section>
            <h3 className="font-medium">{copy.disagreement}</h3>
            <p>{(summary?.disagreement ?? []).map((item) => item.label).join(", ") || "—"}</p>
          </section>
          <section>
            <h3 className="font-medium">{copy.tradeoffs}</h3>
            <p>{summary?.tradeoffs?.[0]?.note ?? "—"}</p>
          </section>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.join}</CardTitle>
        <CardDescription>{copy.joinHint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <label className="grid gap-1 text-sm">
          {copy.displayName}
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <Button
          type="button"
          onClick={() =>
            void import("@/lib/groups")
              .then(({ joinShare }) => joinShare(token, name))
              .then((joined) => setTripId(joined.trip_id))
              .catch((err: Error) => setError(err.message))
          }
        >
          {copy.guestJoin}
        </Button>
      </CardContent>
    </Card>
  );
}
