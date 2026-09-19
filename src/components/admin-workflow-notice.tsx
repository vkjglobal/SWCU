export function AdminWorkflowNotice({ editor }: { editor: boolean }) {
  if (!editor) return null;
  return (
    <p className="mt-4 border-l-4 border-ocean-teal bg-ocean-teal/10 px-4 py-3 text-sm font-medium text-deep-navy">
      Your changes will not appear on the website until an Administrator approves and publishes them.
    </p>
  );
}