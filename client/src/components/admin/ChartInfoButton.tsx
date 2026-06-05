import React, { useState } from "react";
import { Info, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ChartInfoButtonProps {
    title: string;
    description: string;
    methodology: string[];
    dataSource?: string;
    updateFrequency?: string;
}

export const ChartInfoButton: React.FC<ChartInfoButtonProps> = ({
    title,
    description,
    methodology,
    dataSource = "Admin Dashboard Database",
    updateFrequency = "Real-time",
}) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full transition-all"
                onClick={() => setOpen(true)}
                title="Chart Information"
            >
                <Info className="h-4 w-4 text-gray-500 hover:text-[#008060]" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Info className="h-5 w-5 text-[#008060]" />
                            {title}
                        </DialogTitle>
                        <DialogDescription className="text-base text-gray-700 mt-2">
                            {description}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        {/* Methodology Section */}
                        <div>
                            <h4 className="font-semibold text-sm text-gray-900 mb-2 flex items-center gap-2">
                                <span className="text-[#008060]">📊</span>
                                How This Chart is Generated
                            </h4>
                            <ul className="space-y-2">
                                {methodology.map((step, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                        <span className="text-[#008060] font-semibold mt-0.5">{index + 1}.</span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Data Source */}
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-700">Data Source:</span>
                                <span className="text-sm text-gray-600">{dataSource}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-700">Update Frequency:</span>
                                <span className="text-sm text-gray-600">{updateFrequency}</span>
                            </div>
                        </div>

                        {/* Close Button */}
                        <Button
                            onClick={() => setOpen(false)}
                            className="w-full bg-[#008060] hover:bg-[#006b51]"
                        >
                            Got it!
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
