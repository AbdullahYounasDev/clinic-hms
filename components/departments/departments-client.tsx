// components/departments/departments-client.tsx
"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Card, CardBody, Button, FormField, Input, Alert, Badge, Modal, EmptyState,
} from "@/components/ui";
import {
  Plus, Trash2, Network, Edit2, Search, Building2, CheckCircle2, ShieldAlert,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface DepartmentItem {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

export function DepartmentsClient() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", code: "", description: "" });
  const [editDept, setEditDept] = useState<{ id: string; name: string; code: string; description: string } | null>(null);
  const [deptError, setDeptError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; label: string }>({ open: false, id: "", label: "" });

  const isSA = session?.user.isSuperAdmin;
  const perms = session?.user.permissions || [];
  const canCreate = isSA || perms.includes("departments:create") || perms.includes("settings:update");
  const canEdit = isSA || perms.includes("departments:update") || perms.includes("settings:update");
  const canDelete = isSA || perms.includes("departments:delete") || perms.includes("settings:update");

  const { data: deptsData, isLoading } = useQuery({
    queryKey: ["departments", searchTerm, from, to],
    queryFn: () => axios.get("/api/settings/departments", {
      params: {
        search: searchTerm || undefined,
        from: from || undefined,
        to: to || undefined,
      }
    }).then((r) => r.data),
  });

  const departments: DepartmentItem[] = deptsData?.data || [];

  const filteredDepts = departments;

  const activeCount = departments.filter((d) => d.isActive).length;

  const addDeptMutation = useMutation({
    mutationFn: (d: { name: string; code: string; description: string }) =>
      axios.post("/api/settings/departments", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setNewDept({ name: "", code: "", description: "" });
      setDeptError("");
      setIsAddOpen(false);
      toast.success("Department added successfully!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setDeptError(msg || "Failed to add department");
      toast.error(msg || "Failed to add department");
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: (d: { id: string; name: string; code: string; description: string }) =>
      axios.put(`/api/settings/departments/${d.id}`, {
        name: d.name,
        code: d.code,
        description: d.description,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setEditDept(null);
      setDeptError("");
      toast.success("Department updated successfully!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setDeptError(msg || "Failed to update department");
      toast.error(msg || "Failed to update department");
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/settings/departments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeleteConfirm({ open: false, id: "", label: "" });
      toast.success("Department deleted successfully!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || "Failed to delete department");
    },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Network className="w-5 h-5 text-teal-600" />
            Departments
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage hospital and clinic clinical/administrative departments
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setDeptError(""); setIsAddOpen(true); }} size="sm">
            <Plus className="w-3.5 h-3.5" /> Add Department
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardBody className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Departments</p>
              <p className="text-xl font-bold text-gray-900">{departments.length}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Active Departments</p>
              <p className="text-xl font-bold text-emerald-700">{activeCount}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Role Permissions</p>
              <p className="text-xs font-semibold text-gray-700 mt-1">Configurable in Roles</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Table / List Card */}
      <Card>
        <CardBody className="p-4 sm:p-5 space-y-4">
          {/* Search bar & Date filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 text-xs" title="From Date" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 text-xs" title="To Date" />
                {(searchTerm || from || to) && (
                  <button onClick={() => { setSearchTerm(""); setFrom(""); setTo(""); }} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Clear</button>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-500 font-medium shrink-0">
              Showing {filteredDepts.length} of {departments.length}
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-gray-400">Loading departments...</div>
          ) : filteredDepts.length === 0 ? (
            <EmptyState
              title={searchTerm ? "No matching departments" : "No departments defined"}
              description={searchTerm ? "Try searching for a different keyword or code." : "Get started by adding your first clinic department."}
              action={
                canCreate && !searchTerm ? (
                  <Button onClick={() => { setDeptError(""); setIsAddOpen(true); }} size="sm">
                    <Plus className="w-3.5 h-3.5" /> Add Department
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Department Name</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Status</th>
                      {(canEdit || canDelete) && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDepts.map((d) => (
                      <tr key={d._id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-teal-800">
                          <Badge variant="outline" className="font-mono font-semibold text-[11px]">
                            {d.code}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{d.name}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-md truncate">
                          {d.description || <span className="text-gray-400 italic">No description</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={d.isActive ? "success" : "default"}>
                            {d.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        {(canEdit || canDelete) && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setDeptError("");
                                    setEditDept({
                                      id: d._id,
                                      name: d.name,
                                      code: d.code,
                                      description: d.description || "",
                                    });
                                  }}
                                  title="Edit Department"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      open: true,
                                      id: d._id,
                                      label: `${d.name} (${d.code})`,
                                    })
                                  }
                                  title="Delete Department"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="sm:hidden space-y-3">
                {filteredDepts.map((d) => (
                  <div
                    key={d._id}
                    className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono font-semibold text-[11px]">
                          {d.code}
                        </Badge>
                        <span className="text-xs font-semibold text-gray-900">{d.name}</span>
                      </div>
                      <Badge variant={d.isActive ? "success" : "default"}>
                        {d.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {d.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{d.description}</p>
                    )}
                    {(canEdit || canDelete) && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200/60">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setDeptError("");
                              setEditDept({
                                id: d._id,
                                name: d.name,
                                code: d.code,
                                description: d.description || "",
                              });
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gray-600 mr-1" /> Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              setDeleteConfirm({
                                open: true,
                                id: d._id,
                                label: `${d.name} (${d.code})`,
                              })
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Add Department Modal */}
      <Modal open={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Department" size="md">
        <div className="space-y-4 text-xs mt-2">
          {deptError && <Alert type="error">{deptError}</Alert>}
          <FormField label="Department Name" required>
            <Input
              value={newDept.name}
              onChange={(e) => setNewDept((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Cardiology"
            />
          </FormField>
          <FormField label="Department Code" required>
            <Input
              value={newDept.code}
              onChange={(e) => setNewDept((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. CARD"
            />
          </FormField>
          <FormField label="Description">
            <Input
              value={newDept.description}
              onChange={(e) => setNewDept((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional notes or details"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newDept.name.trim() || !newDept.code.trim()}
              loading={addDeptMutation.isPending}
              onClick={() => addDeptMutation.mutate(newDept)}
            >
              Add Department
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Department Modal */}
      <Modal open={!!editDept} onClose={() => setEditDept(null)} title="Edit Department" size="md">
        {editDept && (
          <div className="space-y-4 text-xs mt-2">
            {deptError && <Alert type="error">{deptError}</Alert>}
            <FormField label="Department Name" required>
              <Input
                value={editDept.name}
                onChange={(e) =>
                  setEditDept((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                placeholder="Department Name"
              />
            </FormField>
            <FormField label="Department Code" required>
              <Input
                value={editDept.code}
                onChange={(e) =>
                  setEditDept((prev) =>
                    prev ? { ...prev, code: e.target.value.toUpperCase() } : null
                  )
                }
                placeholder="CODE"
              />
            </FormField>
            <FormField label="Description">
              <Input
                value={editDept.description}
                onChange={(e) =>
                  setEditDept((prev) =>
                    prev ? { ...prev, description: e.target.value } : null
                  )
                }
                placeholder="Description (Optional)"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setEditDept(null)}>
                Cancel
              </Button>
              <Button
                disabled={!editDept.name.trim() || !editDept.code.trim()}
                loading={updateDeptMutation.isPending}
                onClick={() => updateDeptMutation.mutate(editDept)}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Department Modal */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: "", label: "" })}
        title="Delete Department"
        size="sm"
      >
        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Delete permanently?</p>
              <p className="text-xs text-red-600 mt-0.5">
                This will permanently delete <strong>{deleteConfirm.label}</strong>.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setDeleteConfirm({ open: false, id: "", label: "" })}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteDeptMutation.isPending}
              onClick={() => deleteDeptMutation.mutate(deleteConfirm.id)}
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
