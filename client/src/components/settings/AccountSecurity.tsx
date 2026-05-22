import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
    changeEmailSchema,
    type ChangeEmailData,
} from "../../../../shared/validation";
import { Lock, Mail, Loader2, ShieldCheck, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const AccountSecurity = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    return (
        <Card>
            <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#008060]" />
                    <CardTitle className="text-lg sm:text-xl">Account Security</CardTitle>
                </div>
                <CardDescription>
                    Manage your sensitive account information. Updates require your current password.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
                <Accordion type="single" collapsible className="w-full">

                    <AccordionItem value="email">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                                <Mail className="w-4 h-4 text-gray-500" />
                                <span className="font-medium">Change Email Address</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                            <ChangeEmailForm />
                        </AccordionContent>
                    </AccordionItem>

                </Accordion>
            </CardContent>
        </Card>
    );
};

// --- Sub-components ---

// Password form removed as per requirements

const ChangeEmailForm = () => {
    const { user, refreshAlumni } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const userId = user?.id;
    const currentEmail = user?.email;

    const form = useForm<ChangeEmailData>({
        resolver: zodResolver(changeEmailSchema),
        defaultValues: {
            currentPassword: "",
            newEmail: "",
        },
    });

    const onSubmit = async (data: ChangeEmailData) => {
        if (!userId) return;
        setLoading(true);
        try {
            const response = await fetch("/api/security/email", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "user-id": userId,
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to update email");
            }

            toast({
                title: "Success",
                description: "Your email has been updated successfully.",
            });
            await refreshAlumni();
            form.reset();
            // Optional: Trigger a refresh or logout if email is critical for session
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form {...form}>
            <div className="mb-4 text-sm text-gray-600">
                Current Email: <span className="font-semibold text-gray-900">{currentEmail || "Unknown"}</span>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
                <FormField
                    control={form.control}
                    name="newEmail"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Email Address</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="Enter new email address" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Current Password (for Verification)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter current password"
                                        className="pr-10"
                                        {...field}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-[#008060]">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Update Email
                </Button>
            </form>
        </Form>
    );
};


