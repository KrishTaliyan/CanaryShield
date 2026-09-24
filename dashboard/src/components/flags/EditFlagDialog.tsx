import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { patchFlag } from "../../api/flags";
import type { Flag } from "../../api/types";
import { useToast } from "../../hooks/useAppContext";
import Button from "../ui/Button";
import { Field, Input, Textarea } from "../ui/Field";
import Modal from "../ui/Modal";

/** Edits a flag's name and description (PATCH /flags/{key}). The key cannot change. */
export default function EditFlagDialog({ flag, open, onClose }: { flag: Flag; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(flag.name);
  const [description, setDescription] = useState(flag.description);

  useEffect(() => {
    if (open) {
      setName(flag.name);
      setDescription(flag.description);
    }
  }, [open, flag.name, flag.description]);

  const mutation = useMutation({
    mutationFn: () => patchFlag(flag.key, { name: name.trim(), description: description.trim() }),
    onSuccess: async () => {
      toast({ tone: "success", title: "Flag details saved" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
        queryClient.invalidateQueries({ queryKey: ["events", flag.key] }),
      ]);
      onClose();
    },
    onError: (error) => toast({ tone: "error", title: "Could not save details", description: error.message }),
  });

  const unchanged = name.trim() === flag.name && description.trim() === flag.description;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || unchanged) return;
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      title="Edit flag details"
      description={<>Key <code className="font-mono text-ink">{flag.key}</code> is permanent: services look the flag up by it.</>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button variant="primary" type="submit" form="edit-flag-form" loading={mutation.isPending} disabled={!name.trim() || unchanged}>Save details</Button>
        </>
      }
    >
      <form id="edit-flag-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" required error={name.trim() ? null : "A name is required."}>
          {(props) => <Input {...props} data-autofocus value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />}
        </Field>
        <Field label="Description" hint="What the flag controls and who owns it.">
          {(props) => <Textarea {...props} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />}
        </Field>
        {mutation.error && <p className="text-sm text-danger" role="alert">{mutation.error.message}</p>}
      </form>
    </Modal>
  );
}
