import { Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { normalizeHost, validateHost } from "../lib/validate";
import { Overlay } from "./Overlay";
import { Field, GhostButton, ModalCard, ModalFooter, ModalHeader, PrimaryButton, TextInput } from "./ui-bits";

interface AddDeviceModalProps {
  existingHosts: string[];
  onAdd: (name: string, host: string) => Promise<void>;
  onClose: () => void;
}

export function AddDeviceModal({ existingHosts, onAdd, onClose }: AddDeviceModalProps) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hostRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hostRef.current?.focus();
  }, []);

  const submit = async () => {
    if (busy) return;

    const hostError = validateHost(host);
    if (hostError) {
      setError(hostError);
      hostRef.current?.focus();
      return;
    }

    if (existingHosts.some((existing) => normalizeHost(existing) === normalizeHost(host))) {
      setError("This host is already being monitored");
      return;
    }

    setBusy(true);
    try {
      await onAdd(name, host);
      onClose();
    } catch (cause) {
      toast.error("Could not add the device", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalCard maxWidth={420}>
        <ModalHeader title="Add Device" onClose={onClose} />

        <div className="flex flex-col gap-4 px-6 py-5">
          <Field label="Device Name" hint="Optional — defaults to the host address.">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Office Router"
              maxLength={80}
              onKeyDown={(event) => {
                if (event.key === "Enter") hostRef.current?.focus();
              }}
            />
          </Field>

          <Field
            label={
              <>
                IP Address / Domain <span style={{ color: "#ef4444" }}>*</span>
              </>
            }
            hint={error ? undefined : "IPv4, IPv6 or a domain name, e.g. 192.168.1.1 or example.com"}
          >
            <TextInput
              ref={hostRef}
              value={host}
              onChange={(event) => {
                setHost(event.target.value);
                setError(null);
              }}
              placeholder="192.168.1.1 or example.com"
              mono
              invalid={Boolean(error)}
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </Field>

          {error && (
            <p className="text-xs -mt-1" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}
        </div>

        <ModalFooter>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Device
          </PrimaryButton>
        </ModalFooter>
      </ModalCard>
    </Overlay>
  );
}
