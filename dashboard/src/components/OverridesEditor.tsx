import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { setOverrides } from "../api/flags";
import type { Overrides } from "../api/types";
import type { LayoutContext } from "./Layout";

interface OverridesEditorProps {
  flagKey: string;
  overrides: Overrides;
}

const textareaClass = "min-h-28 w-full resize-y rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
const toText = (users: string[]) => users.join("\n");
const toUsers = (value: string) => value.split(/[\n,]/).map((userId) => userId.trim()).filter(Boolean);

export default function OverridesEditor({ flagKey, overrides }: OverridesEditorProps) {
  const { notify } = useOutletContext<LayoutContext>();
  const queryClient = useQueryClient();
  const [include, setInclude] = useState(() => toText(overrides.include));
  const [exclude, setExclude] = useState(() => toText(overrides.exclude));
  const mutation = useMutation({
    mutationFn: ({ key, overrides: value }: { key: string; overrides: Overrides }) => setOverrides(key, value),
    onSuccess: async () => {
      notify("Overrides saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
        queryClient.invalidateQueries({ queryKey: ["events", flagKey] }),
      ]);
    },
  });

  useEffect(() => {
    setInclude(toText(overrides.include));
    setExclude(toText(overrides.exclude));
  }, [overrides]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ key: flagKey, overrides: { include: toUsers(include), exclude: toUsers(exclude) } });
  }

  return (
    <section aria-labelledby="overrides-heading" className="border-y border-neutral-200 bg-white p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-950" id="overrides-heading">User overrides</h2>
      <form className="mt-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="include-users">Included user IDs</label>
            <textarea className={textareaClass} id="include-users" onChange={(event) => { setInclude(event.target.value); mutation.reset(); }} value={include} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="exclude-users">Excluded user IDs</label>
            <textarea className={textareaClass} id="exclude-users" onChange={(event) => { setExclude(event.target.value); mutation.reset(); }} value={exclude} />
          </div>
        </div>
        {mutation.error && <p className="mt-3 text-sm text-red-800" role="alert">{mutation.error.message}</p>}
        {mutation.isSuccess && <p className="mt-3 text-sm text-emerald-800" role="status">Overrides saved</p>}
        <button
          className="mt-4 rounded bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={mutation.isPending}
          type="submit"
        >{mutation.isPending ? "Saving…" : "Save overrides"}</button>
      </form>
    </section>
  );
}
