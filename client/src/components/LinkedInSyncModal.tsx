
import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";

interface Mismatch {
    field: string;
    label: string;
    current: string;
    currentUrl?: string;
    linkedin: string;
    linkedinUrl?: string;
}

interface LinkedInSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    mismatches: Mismatch[];
    onConfirm: (selectedFields: string[]) => void;
    isLoading: boolean;
}

export const LinkedInSyncModal = ({
    isOpen,
    onClose,
    mismatches,
    onConfirm,
    isLoading
}: LinkedInSyncModalProps) => {
    const [selectedFields, setSelectedFields] = React.useState<string[]>(
        mismatches.map(m => m.field)
    );

    const toggleField = (field: string) => {
        setSelectedFields(prev =>
            prev.includes(field)
                ? prev.filter(f => f !== field)
                : [...prev, field]
        );
    };

    const handleConfirm = () => {
        onConfirm(selectedFields);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-blue-700">
                        <RefreshCw className="w-5 h-5" />
                        Synchronize with LinkedIn
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2">
                        We found discrepancies between your profile and LinkedIn. Choose which fields you'd like to update.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {mismatches.map((mismatch) => (
                        <div
                            key={mismatch.field}
                            className={`p-4 rounded-xl border transition-all ${selectedFields.includes(mismatch.field)
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-gray-50 border-gray-100 opacity-70'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="pt-1">
                                    <Checkbox
                                        id={`field-${mismatch.field}`}
                                        checked={selectedFields.includes(mismatch.field)}
                                        onCheckedChange={() => toggleField(mismatch.field)}
                                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                    />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label
                                            htmlFor={`field-${mismatch.field}`}
                                            className="text-sm font-semibold text-gray-900 cursor-pointer"
                                        >
                                            {mismatch.label}
                                        </label>
                                        <Badge variant="outline" className="bg-white text-blue-600 border-blue-100 text-[10px] px-1.5 py-0">
                                            LinkedIn Source
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Current</p>
                                            {mismatch.field === 'profile_picture' ? (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-10 w-10 border border-gray-200">
                                                        <AvatarImage src={mismatch.currentUrl} />
                                                        <AvatarFallback className="bg-gray-100 text-[10px]">NA</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs text-gray-500">{mismatch.current}</span>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-600 truncate bg-white p-1.5 rounded border border-gray-100 min-h-[34px] flex items-center">
                                                    {mismatch.current || <span className="text-gray-300 italic">Empty</span>}
                                                </p>
                                            )}
                                        </div>

                                        <ArrowRight className="w-4 h-4 text-gray-300 mt-4" />

                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">LinkedIn</p>
                                            {mismatch.field === 'profile_picture' ? (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-10 w-10 border-2 border-blue-400 shadow-sm">
                                                        <AvatarImage src={mismatch.linkedinUrl} />
                                                        <AvatarFallback className="bg-blue-100 text-blue-600 text-[10px]">IN</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs text-blue-700 font-medium">New Photo</span>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-blue-700 font-semibold truncate bg-blue-100/50 p-1.5 rounded border border-blue-200 min-h-[34px] flex items-center">
                                                    {mismatch.linkedin}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {selectedFields.length === 0 && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-700">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p className="text-xs">No fields selected. Click confirm to keep your profile unchanged.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0 mt-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        Don't Update
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Updating...
                            </span>
                        ) : (
                            selectedFields.length > 0 ? `Update ${selectedFields.length} Fields` : 'Keep Current'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
