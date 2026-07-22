import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, Plus, X } from 'lucide-react';
import * as api from '../../api/studyEndpoints';
import { useToast } from '../../lib/toast';
import { apiErrorMessage } from '../../lib/api';
import { useStudyAuth } from '../../lib/studyAuth';
import { Badge, Button, Card, ConfirmModal, Input, Label, Modal, PageHeader, Select } from '../../components/ui';
import { PermissionMatrix } from '../../components/PermissionMatrix';
import type { UserRole } from '../../types';

export function StudySettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { logout, can } = useStudyAuth();

  const configQuery = useQuery({ queryKey: ['study', 'config'], queryFn: api.getConfig });
  const resourcesQuery = useQuery({ queryKey: ['study', 'resources'], queryFn: api.getResources });
  const usersQuery = useQuery({ queryKey: ['study', 'users'], queryFn: api.getUsers });
  const permCatalogQuery = useQuery({ queryKey: ['study', 'permissions'], queryFn: api.getPermissionCatalog });
  const permCatalog = permCatalogQuery.data ?? [];

  // --- hourly rate ---
  const updateConfig = useMutation({
    mutationFn: api.updateConfig,
    onSuccess: (updated) => {
      qc.setQueryData(['study', 'config'], updated);
      toast.show('Saved', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  // --- resources ---
  const [newResourceNumber, setNewResourceNumber] = useState('');
  const [newResourceLabel, setNewResourceLabel] = useState('');
  const [newResourceKind, setNewResourceKind] = useState<'STUDY_TABLE' | 'STUDY_ROOM'>('STUDY_TABLE');
  const [deleteResourceId, setDeleteResourceId] = useState<string | null>(null);
  const createResource = useMutation({
    mutationFn: () =>
      api.createResource({ number: parseInt(newResourceNumber, 10), label: newResourceLabel.trim() || undefined, kind: newResourceKind }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study', 'resources'] });
      setNewResourceNumber('');
      setNewResourceLabel('');
      toast.show('Resource added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeResource = useMutation({
    mutationFn: (id: string) => api.deleteResource(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study', 'resources'] });
      setDeleteResourceId(null);
      toast.show('Resource removed');
    },
    onError: (e) => {
      setDeleteResourceId(null);
      toast.show(apiErrorMessage(e), 'error');
    },
  });

  // --- users ---
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('STAFF');
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>([]);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [permissionsUserId, setPermissionsUserId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const createUser = useMutation({
    mutationFn: () => api.createUser(newUsername.trim(), newUserPassword, newUserRole, newUserPermissions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study', 'users'] });
      setNewUsername('');
      setNewUserPassword('');
      setNewUserRole('STAFF');
      setNewUserPermissions([]);
      toast.show('User added', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const toggleUserActive = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => api.updateUser(vars.id, { active: vars.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', 'users'] }),
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const changeUserRole = useMutation({
    mutationFn: (vars: { id: string; role: UserRole }) => api.updateUser(vars.id, { role: vars.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', 'users'] }),
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const saveUserPermissions = useMutation({
    mutationFn: () => api.updateUser(permissionsUserId as string, { permissions: editingPermissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study', 'users'] });
      setPermissionsUserId(null);
      toast.show('Permissions saved', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const resetUserPassword = useMutation({
    mutationFn: () => api.resetUserPassword(resetPasswordUserId as string, resetPasswordValue),
    onSuccess: () => {
      setResetPasswordUserId(null);
      setResetPasswordValue('');
      toast.show('Password reset', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });
  const removeUser = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study', 'users'] });
      setDeleteUserId(null);
      toast.show('User removed');
    },
    onError: (e) => {
      setDeleteUserId(null);
      toast.show(apiErrorMessage(e), 'error');
    },
  });

  // --- change own password ---
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const changePassword = useMutation({
    mutationFn: () => api.changePassword(currentPw, newPw),
    onSuccess: () => {
      setPwModalOpen(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      toast.show('Password changed!', 'success');
    },
    onError: (e) => toast.show(apiErrorMessage(e), 'error'),
  });

  function handleChangePassword() {
    if (newPw.length < 6) {
      toast.show('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      toast.show('Passwords do not match', 'error');
      return;
    }
    changePassword.mutate();
  }

  const settings = configQuery.data;

  return (
    <div>
      <PageHeader title="Settings" description="Hourly rate, resources, and team access for the Study system." />

      {can('study_config_manage') && (
      <Card title="Pricing">
        <div className="flex items-center justify-between border-b border-border py-3.5 first:pt-0">
          <div>
            <div className="text-sm font-medium text-ink">Table hourly rate</div>
            <div className="text-xs text-muted">Each drink ordered gives 1h 30m of table time free</div>
          </div>
          <Input
            type="number"
            className="w-32"
            defaultValue={settings?.tableHourlyRate}
            key={`table-rate-${settings?.tableHourlyRate}`}
            onBlur={(e) => updateConfig.mutate({ tableHourlyRate: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center justify-between border-b border-border py-3.5">
          <div>
            <div className="text-sm font-medium text-ink">Room hourly rate</div>
            <div className="text-xs text-muted">Rooms always bill full elapsed time, drinks don't reduce it</div>
          </div>
          <Input
            type="number"
            className="w-32"
            defaultValue={settings?.roomHourlyRate}
            key={`room-rate-${settings?.roomHourlyRate}`}
            onBlur={(e) => updateConfig.mutate({ roomHourlyRate: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center justify-between py-3.5 last:pb-0">
          <div className="text-sm font-medium text-ink">Currency</div>
          <Input
            className="w-24"
            defaultValue={settings?.currency}
            key={`cur-${settings?.currency}`}
            onBlur={(e) => updateConfig.mutate({ currency: e.target.value || 'SYP' })}
          />
        </div>
      </Card>
      )}

      {can('study_resources_manage') && (
      <Card title="Tables & rooms">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-28">
            <Label>Number</Label>
            <Input type="number" min={1} value={newResourceNumber} onChange={(e) => setNewResourceNumber(e.target.value)} placeholder="110" />
          </div>
          <div className="min-w-[160px]">
            <Label>Label (optional)</Label>
            <Input value={newResourceLabel} onChange={(e) => setNewResourceLabel(e.target.value)} placeholder="e.g. Study Table 10" />
          </div>
          <div className="w-40">
            <Label>Kind</Label>
            <Select value={newResourceKind} onChange={(e) => setNewResourceKind(e.target.value as 'STUDY_TABLE' | 'STUDY_ROOM')}>
              <option value="STUDY_TABLE">Table</option>
              <option value="STUDY_ROOM">Room</option>
            </Select>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              const n = parseInt(newResourceNumber, 10);
              if (!Number.isFinite(n) || n <= 0) {
                toast.show('Enter a valid number');
                return;
              }
              createResource.mutate();
            }}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
          {(resourcesQuery.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm font-medium text-ink">
                {r.label ?? `#${r.number}`}
                <Badge tone={r.kind === 'STUDY_ROOM' ? 'blue' : 'gray'}>{r.kind === 'STUDY_ROOM' ? 'Room' : 'Table'}</Badge>
              </span>
              <Button size="sm" variant="danger" onClick={() => setDeleteResourceId(r.id)}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          {(resourcesQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No resources yet</div>}
        </div>
      </Card>
      )}

      {can('study_users_manage') && (
      <Card title="Team access">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label>Username</Label>
            <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. sara" />
          </div>
          <div className="min-w-[160px]">
            <Label>Password</Label>
            <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="min 6 characters" />
          </div>
          <div className="min-w-[120px]">
            <Label>Role</Label>
            <Select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as UserRole)}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (!newUsername.trim() || newUserPassword.length < 6) {
                toast.show('Enter a username and a password (min 6 characters)');
                return;
              }
              createUser.mutate();
            }}
          >
            <Plus className="size-4" />
            Add user
          </Button>
        </div>
        {newUserRole === 'STAFF' && permCatalog.length > 0 && (
          <div className="mb-4">
            <Label>Permissions (Staff only — Admin always has full access)</Label>
            <PermissionMatrix catalog={permCatalog} selected={newUserPermissions} onChange={setNewUserPermissions} />
          </div>
        )}
        <div>
          {(usersQuery.data ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                {u.username}
                <Badge tone={u.role === 'ADMIN' ? 'amber' : 'gray'}>{u.role === 'ADMIN' ? 'Admin' : 'Staff'}</Badge>
                <Badge tone={u.active ? 'green' : 'gray'}>{u.active ? 'Active' : 'Disabled'}</Badge>
                {u.role === 'STAFF' && u.permissions.length > 0 && <Badge tone="blue">{u.permissions.length} permission{u.permissions.length === 1 ? '' : 's'}</Badge>}
              </span>
              <div className="flex items-center gap-1.5">
                <Select
                  className="w-auto py-1.5 text-xs"
                  value={u.role}
                  onChange={(e) => changeUserRole.mutate({ id: u.id, role: e.target.value as UserRole })}
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </Select>
                {u.role === 'STAFF' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPermissionsUserId(u.id);
                      setEditingPermissions(u.permissions);
                    }}
                  >
                    Permissions
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => toggleUserActive.mutate({ id: u.id, active: !u.active })}>
                  {u.active ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setResetPasswordUserId(u.id)}>
                  <KeyRound className="size-3.5" />
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteUserId(u.id)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {(usersQuery.data ?? []).length === 0 && <div className="py-2 text-sm text-muted">No users yet</div>}
        </div>
      </Card>
      )}

      <Card title="Security">
        <div className="flex items-center justify-between border-b border-border py-3.5 first:pt-0">
          <div className="text-sm font-medium text-ink">Change password</div>
          <Button variant="secondary" onClick={() => setPwModalOpen(true)}>
            <KeyRound className="size-4" />
            Change
          </Button>
        </div>
        <div className="flex items-center justify-between py-3.5 last:pb-0">
          <div className="text-sm font-medium text-ink">Lock this session</div>
          <Button variant="dark" onClick={logout}>
            <Lock className="size-4" />
            Lock
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={!!deleteResourceId}
        onClose={() => setDeleteResourceId(null)}
        onConfirm={() => deleteResourceId && removeResource.mutate(deleteResourceId)}
        title="Remove resource?"
        message="Resources with an active booking can't be removed until it's completed or cancelled."
        confirmLabel="Remove"
        danger
      />

      <ConfirmModal
        open={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={() => deleteUserId && removeUser.mutate(deleteUserId)}
        title="Remove user?"
        message="This account will no longer be able to log in."
        confirmLabel="Remove user"
        danger
      />

      <Modal open={!!resetPasswordUserId} onClose={() => setResetPasswordUserId(null)} title="Reset password">
        <div className="mb-5">
          <Label>New password (min 6 characters)</Label>
          <Input type="password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              if (resetPasswordValue.length < 6) {
                toast.show('Password must be at least 6 characters');
                return;
              }
              resetUserPassword.mutate();
            }}
          >
            Save
          </Button>
          <Button variant="secondary" onClick={() => setResetPasswordUserId(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal open={!!permissionsUserId} onClose={() => setPermissionsUserId(null)} title="Edit permissions" maxWidth="600px">
        <PermissionMatrix catalog={permCatalog} selected={editingPermissions} onChange={setEditingPermissions} />
        <div className="mt-5 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => saveUserPermissions.mutate()}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => setPermissionsUserId(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal open={pwModalOpen} onClose={() => setPwModalOpen(false)} title="Change password">
        <div className="mb-3">
          <Label>Current password</Label>
          <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
        </div>
        <div className="mb-3">
          <Label>New password (min 6 characters)</Label>
          <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
        <div className="mb-5">
          <Label>Confirm new password</Label>
          <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={handleChangePassword}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => setPwModalOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
