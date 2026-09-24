import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { createFlag } from "../api/flags";
import type { LayoutContext } from "../components/Layout";

const keyPattern = "[a-z0-9_]{3,64}";

export default function CreateFlag() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useOutletContext<LayoutContext>();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = useMutation({
    mutationFn: createFlag,
    onSuccess: async (flag) => {
      await queryClient.invalidateQueries({ queryKey: ["flags"] });
      notify(`Flag ${flag.key} created`);
      navigate(`/flags/${encodeURIComponent(flag.key)}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({ key: key.trim(), name: name.trim(), description: description.trim() });
  }

  return (
    <main className="mx-auto max-w-3xl p-5 md:p-8">
      <Link className="text-sm font-medium text-emerald-800 hover:underline" to="/">Back to flags</Link>
      <h1 className="mt-5 text-2xl font-semibold text-neutral-950">Create flag</h1>
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="flag-key">Key</label>
          <input
            autoComplete="off"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            id="flag-key"
            maxLength={64}
            minLength={3}
            onChange={(event) => setKey(event.target.value)}
            pattern={keyPattern}
            required
            title="Use 3 to 64 lowercase letters, numbers, or underscores."
            value={key}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="flag-name">Name</label>
          <input
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            id="flag-name"
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="flag-description">Description</label>
          <textarea
            className="min-h-24 w-full resize-y rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            id="flag-description"
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            value={description}
          />
        </div>
        {createMutation.isError && (
          <p className="text-sm text-red-800" role="alert">{createMutation.error.message}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={createMutation.isPending}
            type="submit"
          >
            {createMutation.isPending ? "Creating…" : "Create flag"}
          </button>
          <Link className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100" to="/">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
