
import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
// Pagination imports removed
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, GraduationCap, Shield, Pencil, Lock, Unlock, Users, School, Globe } from "lucide-react";
import { formatDateTimeIST, formatTimeIST } from "@/lib/dateUtils";

interface AdminUsersTableProps {
    users: any[];
    totalCount: number;
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    loading: boolean;
    error: string | null;
    // Edit Handlers
    editingCell: { userId: string; field: string; } | null;
    setEditingCell: (cell: { userId: string; field: string; } | null) => void;
    editValue: string;
    setEditValue?: (value: string) => void;
    handleCellClick: (userId: string, field: string, currentValue: any) => void;
    handleEditChange: (value: string) => void;
    handleEditSubmit: (userId: string, field: string) => void;
    // Action Handlers
    handleToggleChampion: (userId: string, currentStatus: boolean, batch: string | null) => void;
    setConfirmDialog: (dialog: any) => void;
    setBlockDialog: (dialog: any) => void;
    setLocation: (path: string) => void;
    handleBulkRoleUpdate?: (userIds: string[], role: 'student' | 'alumni') => Promise<void>;
    updatingParams?: boolean;
}

export function AdminUsersTable({
    users,
    totalCount,
    currentPage,
    itemsPerPage,
    onPageChange,
    loading,
    error,
    editingCell,
    setEditingCell: _setEditingCell,
    editValue,
    setEditValue,
    handleCellClick,
    handleEditChange: _handleEditChange,
    handleEditSubmit: _handleEditSubmit,
    handleToggleChampion,
    setConfirmDialog,
    setBlockDialog,
    setLocation,
    handleBulkRoleUpdate,
    updatingParams = false
}: AdminUsersTableProps) {
    // Selection State
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // Toggle specific user selection
    const toggleUserSelection = (userId: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    // Helper to check if a user is eligible for bulk role update
    const isEligibleForBulkUpdate = (user: any) => {
        return ['student', 'alumni', 'user', null].includes(user.user_role) || (!user.user_role);
    };

    // Toggle select all on current page (only eligible ones)
    const toggleSelectAll = () => {
        const eligibleUsers = users.filter(isEligibleForBulkUpdate);
        const allEligibleSelected = eligibleUsers.length > 0 && eligibleUsers.every(u => selectedUsers.has(u.id));

        if (allEligibleSelected) {
            const newSelected = new Set(selectedUsers);
            eligibleUsers.forEach(u => newSelected.delete(u.id));
            setSelectedUsers(newSelected);
        } else {
            const newSelected = new Set(selectedUsers);
            eligibleUsers.forEach(u => newSelected.add(u.id));
            setSelectedUsers(newSelected);
        }
    };

    const eligibleUsersOnPage = users.filter(isEligibleForBulkUpdate);
    const isAllSelected = eligibleUsersOnPage.length > 0 && eligibleUsersOnPage.every(u => selectedUsers.has(u.id));
    
    // Derived state for Bulk Action Buttons
    const selectedUserObjects = users.filter(u => selectedUsers.has(u.id));
    const showMakeAlumni = selectedUserObjects.some(u => u.user_role !== 'alumni');
    const showMakeStudent = selectedUserObjects.some(u => u.user_role !== 'student');

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-xl bg-white overflow-hidden rounded-2xl ring-1 ring-gray-100">
                <CardHeader className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#008060]/20">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span>User Directory</span>
                            <span className="text-xs font-normal text-gray-500 mt-0.5">Manage all registered accounts</span>
                        </div>
                    </CardTitle>
                    <Badge variant="outline" className="px-3 py-1 bg-white border-gray-200 text-gray-600 shadow-sm">
                        {totalCount} Total Users
                    </Badge>
                </CardHeader>

                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-gray-100 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#008060] rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-gray-500 font-medium animate-pulse">Loading directory...</p>
                        </div>
                    ) : users.length === 0 && !error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <User className="w-10 h-10 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">No users found</h3>
                            <p className="text-gray-500 text-sm max-w-xs mt-1">Try adjusting your filters or search terms to find what you're looking for.</p>
                        </div>
                    ) : (
                        <div className="relative w-full max-w-[100vw] sm:max-w-full overflow-hidden">
                            <div className="overflow-x-auto w-full">
                                {/* Bulk Actions Toolbar */}
                                {
                                    selectedUsers.size > 0 && (
                                        <div className="bg-primary/5 border-b border-primary/20 p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2 sticky left-0 right-0 top-0 z-30 min-w-max">
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-primary pl-2 whitespace-nowrap">{selectedUsers.size} users selected</span>
                                                <div className="h-4 w-px bg-gray-300 mx-2" />
                                            </div>
                                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                                {handleBulkRoleUpdate && (
                                                    <>
                                                        {showMakeAlumni && (
                                                            <Button
                                                                 size="sm"
                                                                 onClick={() => handleBulkRoleUpdate(Array.from(selectedUsers), 'alumni')}
                                                                 disabled={updatingParams}
                                                                 className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs font-medium whitespace-nowrap"
                                                            >
                                                                <span className="mr-1">🎓</span> Make Alumni
                                                            </Button>
                                                        )}
                                                        {showMakeStudent && (
                                                            <Button
                                                                 size="sm"
                                                                 onClick={() => handleBulkRoleUpdate(Array.from(selectedUsers), 'student')}
                                                                 disabled={updatingParams}
                                                                 className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs font-medium whitespace-nowrap"
                                                            >
                                                                <span className="mr-1">📚</span> Make Student
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedUsers(new Set())}
                                                    className="h-8 text-xs whitespace-nowrap"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                }
                                <Table className="w-full table-fixed">
                                    <TableHeader className="bg-gray-50/80">
                                        <TableRow className="border-b border-gray-100 hover:bg-transparent">
                                            <TableHead className="w-[50px] pl-6 sticky left-0 bg-gray-50/80 z-20">
                                                <Checkbox
                                                    checked={isAllSelected}
                                                    onCheckedChange={toggleSelectAll}
                                                    aria-label="Select all"
                                                />
                                            </TableHead>
                                            <TableHead className="w-[220px] pl-2 h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">User Profile</TableHead>
                                            <TableHead className="w-[120px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">Role & Status</TableHead>
                                            <TableHead className="w-[110px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">Academic</TableHead>
                                            <TableHead className="w-[150px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">University</TableHead>
                                            <TableHead className="w-[100px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">Joined</TableHead>
                                            <TableHead className="w-[80px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Champion</TableHead>
                                            <TableHead className="w-[90px] pr-6 h-14 text-xs font-bold text-gray-500 uppercase tracking-wider text-end sticky right-0 bg-gray-50/95 backdrop-blur-sm shadow-sm opacity-100 z-20">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => (
                                            <TableRow
                                                key={user.id}
                                                className={`group transition-all border-b border-gray-50 ${selectedUsers.has(user.id) ? "bg-blue-50/60" : "hover:bg-blue-50/30"}`}
                                            >
                                                <TableCell className="pl-6 py-4 w-[50px] sticky left-0 bg-white group-hover:bg-blue-50/30 z-20 transition-colors">
                                                    <Checkbox
                                                        checked={selectedUsers.has(user.id)}
                                                        onCheckedChange={() => toggleUserSelection(user.id)}
                                                        disabled={!isEligibleForBulkUpdate(user)}
                                                        aria-label={`Select ${user.username}`}
                                                        className={!isEligibleForBulkUpdate(user) ? "opacity-30 cursor-not-allowed" : ""}
                                                    />
                                                </TableCell>
                                                {/* Profile Column */}
                                                <TableCell className="pl-2 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm group-hover:border-blue-100 transition-colors">
                                                                <AvatarImage src={user.profile_picture} alt={user.username} />
                                                                <AvatarFallback className="bg-gradient-to-br from-[#008060] to-[#01a57c] text-white font-bold text-sm">
                                                                    {user.username?.charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            {user.is_admin && (
                                                                <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 ring-2 ring-white shadow-sm">
                                                                    <Shield className="w-2.5 h-2.5" fill="currentColor" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="font-bold text-gray-900 truncate max-w-[180px] flex items-center gap-1.5">
                                                                {(user.first_name || user.last_name)
                                                                    ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                                                    : user.username}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                                                <span className="truncate opacity-70">@{user.username}</span>
                                                                {user.is_admin && (
                                                                    <Badge variant="outline" className="h-3 px-1 py-0 text-[8px] bg-amber-50 text-amber-600 border-amber-200">Admin</Badge>
                                                                )}
                                                                {String(user.account_blocked) === "true" && (
                                                                    <Badge variant="destructive" className="h-3 px-1 py-0 text-[8px]">Blocked</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Role Column */}
                                                <TableCell className="py-4">
                                                    <div onClick={() => handleCellClick(user.id, "user_role", user.user_role)} className="cursor-pointer">
                                                        {editingCell?.userId === user.id && editingCell?.field === "user_role" ? (
                                                            <Select
                                                                value={editValue}
                                                                onValueChange={(value) => {
                                                                    if (setEditValue) setEditValue(value);
                                                                    setConfirmDialog({ open: true, userId: user.id, field: "user_role", oldValue: user.user_role, newValue: value });
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 w-[120px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {['alumni', 'student', 'faculty', 'administrator'].map(role => (
                                                                        <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Badge className={`
                                                                capitalize font-medium shadow-none px-2.5 py-0.5 border
                                                                ${user.user_role === 'administrator' ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' :
                                                                    user.user_role === 'student' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
                                                                        user.user_role === 'faculty' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                                                                            'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}
                                                            `}>
                                                                {user.user_role ? user.user_role.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'Alumni'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Academic Column */}
                                                <TableCell className="py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                                                            <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                                                            {user.graduation_year || <span className="text-gray-300">-</span>}
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            {user.batch && (
                                                                <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
                                                                    Batch: {user.batch}
                                                                </span>
                                                            )}
                                                            {user.branch && (
                                                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit uppercase tracking-tighter">
                                                                    {user.branch}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* University Column */}
                                                <TableCell className="py-4">
                                                    <div className="flex flex-col gap-1">
                                                        {user.university ? (
                                                            <div className="text-xs font-medium text-gray-900 flex items-start gap-1.5 leading-tight">
                                                                <School className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                                                                <span className="line-clamp-2">{user.university}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs">-</span>
                                                        )}
                                                        {user.higher_education_country && (
                                                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                <Globe className="w-2.5 h-2.5 text-blue-400" />
                                                                {user.higher_education_country}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Joined Column */}
                                                <TableCell className="py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-gray-900 font-medium whitespace-nowrap">
                                                            {user.created_at ? formatDateTimeIST(user.created_at).split(',')[0] : '-'}
                                                        </span>
                                                        <span className="text-xs text-gray-400 whitespace-nowrap">
                                                            {user.created_at ? formatTimeIST(user.created_at) : ''}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                {/* Champion Toggle */}
                                                <TableCell className="text-center py-4">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="flex justify-center">
                                                                    <Switch
                                                                        checked={user.is_batch_champion || false}
                                                                        onCheckedChange={() => handleToggleChampion(user.id, user.is_batch_champion || false, user.batch)}
                                                                        disabled={!user.batch}
                                                                        className="data-[state=checked]:bg-amber-500 scale-90"
                                                                    />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{!user.batch ? "Assign batch first" : "Toggle Batch Champion"}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="pr-6 py-4 text-end sticky right-0 bg-white/95 backdrop-blur-sm group-hover:bg-blue-50/50 shadow-l-md z-20 transition-all border-l border-transparent group-hover:border-blue-100">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                                                        onClick={() => setLocation(`/admin/users/${user.id}/edit`)}
                                                                    >
                                                                        <Pencil className="w-4 h-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Edit Profile</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={`h-8 w-8 ${String(user.account_blocked) === "true" ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
                                                                        onClick={() => setBlockDialog({ open: true, userId: user.id, username: user.username, currentlyBlocked: String(user.account_blocked) === "true" })}
                                                                    >
                                                                        {String(user.account_blocked) === "true" ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{String(user.account_blocked) === "true" ? "Unblock Account" : "Block Account"}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        {/* Individual Convert Button removed in favor of bulk actions and direct editing */}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Footer */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-sm text-gray-500 font-medium order-2 sm:order-1">
                                    Displaying <span className="text-gray-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="text-[#008060] font-bold">{totalCount}</span> records
                                </div>
                                <div className="flex items-center gap-1.5 order-1 sm:order-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPageChange(1)}
                                        disabled={currentPage === 1 || loading}
                                        className="h-8 w-8 p-0 border-gray-200"
                                    >
                                        «
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPageChange(currentPage - 1)}
                                        disabled={currentPage === 1 || loading}
                                        className="h-8 px-3 border-gray-200 text-xs font-semibold"
                                    >
                                        Prev
                                    </Button>

                                    <div className="flex items-center gap-1 mx-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={currentPage === pageNum ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => onPageChange(pageNum)}
                                                    className={`h-8 w-8 p-0 text-xs font-bold ${currentPage === pageNum ? "bg-[#008060] hover:bg-[#006b51] shadow-sm" : "border-gray-200 hover:bg-gray-100"}`}
                                                    disabled={loading}
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages || loading}
                                        className="h-8 px-3 border-gray-200 text-xs font-semibold"
                                    >
                                        Next
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPageChange(totalPages)}
                                        disabled={currentPage === totalPages || loading}
                                        className="h-8 w-8 p-0 border-gray-200"
                                    >
                                        »
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )
                    }
                </CardContent >
            </Card >
        </div >
    );
}

