"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { searchMemberTargetsAction } from "@/app/admin/member-services/actions";
import type { MemberSummary } from "@/lib/member-app-admin-contract";
import { Field, inputClass, MemberServiceNotice } from "@/components/member-services-ui";

export function MemberServicesMemberTargetPicker({
  initialAudience,
  initialMember,
  connected,
}: {
  initialAudience: "All Members" | "Individual Member";
  initialMember?: MemberSummary | null;
  connected: boolean;
}) {
  const [audience, setAudience] = useState(initialAudience);
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(initialMember ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function search() {
    if (query.trim().length < 2 || pending) return;
    setError(false);
    startTransition(async () => {
      try {
        setResults(await searchMemberTargetsAction(query.trim()));
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(false);
        setError(true);
      }
    });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  }

  return <div className="grid gap-3">
    <Field label="Audience">
      <select name="audience" value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)} className={inputClass}>
        <option>All Members</option><option>Individual Member</option>
      </select>
    </Field>
    <input type="hidden" name="memberId" value={audience === "Individual Member" ? selectedMember?.id ?? "" : ""} />
    {connected && audience === "Individual Member" && <div className="rounded-lg bg-soft-blue-grey p-4">
      {selectedMember && <p className="mb-3 text-sm font-semibold text-deep-navy">Selected: {selectedMember.name} — {selectedMember.identifier}</p>}
      {!selectedMember && <p className="mb-3 text-sm text-charcoal/65">Search for and select a member.</p>}
      <div role="search" className="flex flex-wrap gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Search by name or member number" aria-label="Search members" className={`${inputClass} min-w-48 flex-1`} />
        <button type="button" onClick={search} disabled={pending || query.trim().length < 2} className="rounded-lg border border-swcu-blue px-4 py-2 text-sm font-semibold text-swcu-blue disabled:opacity-50">{pending ? "Searching…" : "Search members"}</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-swcu-red">We could not search members. Please try again.</p>}
      {searched && results.length === 0 && <p className="mt-3 text-sm text-charcoal/65">No members found. Try another search.</p>}
      {results.length > 0 && <ul className="mt-3 divide-y divide-deep-navy/10 rounded-lg border border-deep-navy/10 bg-white">{results.map((member) => <li key={member.id}><button type="button" onClick={() => setSelectedMember(member)} className="w-full px-3 py-2 text-left text-sm hover:bg-swcu-blue/5">{member.name} — {member.identifier}{selectedMember?.id === member.id && <span className="ml-2 font-semibold text-ocean-teal">Selected</span>}</button></li>)}</ul>}
    </div>}
    {!connected && audience === "Individual Member" && <MemberServiceNotice />}
  </div>;
}