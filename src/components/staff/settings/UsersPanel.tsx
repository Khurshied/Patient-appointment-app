"use client";

import { useEffect, useState } from "react";
import { createUser, fetchUsers, updateUser } from "../api";
import type { StaffRole, StaffUser } from "../types";
import { Banner, Button, Field } from "../ui";

export function UsersPanel() {
  const [rows, setRows] = useState<StaffUser[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [kind, setKind] = useState<"email" | "phone">("email");
  const [roles, setRoles] = useState<StaffRole[]>(["doctor"]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await fetchUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleRole(list: StaffRole[], role: StaffRole) {
    return list.includes(role) ? list.filter((item) => item !== role) : [...list, role];
  }

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Users</h2>
      <p className="staff-muted">
        Invite or disable doctor and admin accounts. A login may hold doctor, admin, or both.
        Patients can be disabled if needed. There is no receptionist role.
      </p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <table className="staff-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Roles</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.displayName}</td>
              <td>
                {row.email}
                {row.phone ? <div className="staff-muted">{row.phone}</div> : null}
              </td>
              <td>
                <div className="staff-check-row">
                  {(["doctor", "admin", "patient"] as const).map((role) => (
                    <label key={role}>
                      <input
                        type="checkbox"
                        checked={row.roles.includes(role)}
                        onChange={async () => {
                          const next = toggleRole(row.roles, role);
                          await updateUser(row.id, { roles: next });
                          await load();
                        }}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </td>
              <td>
                <Button
                  variant={row.disabled ? "secondary" : "danger"}
                  onClick={async () => {
                    await updateUser(row.id, { disabled: !row.disabled });
                    await load();
                  }}
                >
                  {row.disabled ? "Enable" : "Disable"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Invite staff</h3>
      <Field label="Display name">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Field>
      <Field label="Identifier kind">
        <select value={kind} onChange={(e) => setKind(e.target.value as "email" | "phone")}>
          <option value="email">Email</option>
          <option value="phone">Mobile number</option>
        </select>
      </Field>
      <Field label={kind === "email" ? "Email" : "Mobile number"}>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      </Field>
      <Field label="Roles">
        <div className="staff-check-row">
          {(["doctor", "admin"] as const).map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={() => setRoles((prev) => toggleRole(prev, role))}
              />
              {role}
            </label>
          ))}
        </div>
      </Field>
      <Button
        onClick={async () => {
          try {
            await createUser({
              displayName,
              identifier,
              kind,
              roles,
            });
            setDisplayName("");
            setIdentifier("");
            await load();
            setOk("User invited");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not invite user");
          }
        }}
      >
        Invite
      </Button>
    </div>
  );
}
