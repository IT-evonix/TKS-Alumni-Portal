import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, MapPin, Edit, Trash2, X } from 'lucide-react';
import { CityAutocomplete } from './CityAutocomplete';

type LabelType = 'Home' | 'University' | 'Job' | 'Internship' | 'Other';

const LABEL_TYPES: LabelType[] = ['Home', 'University', 'Job', 'Internship', 'Other'];

const LABEL_COLORS: Record<LabelType, string> = {
    Home: 'bg-blue-100 text-blue-700 border-blue-200',
    University: 'bg-purple-100 text-purple-700 border-purple-200',
    Job: 'bg-green-100 text-green-700 border-green-200',
    Internship: 'bg-amber-100 text-amber-700 border-amber-200',
    Other: 'bg-gray-100 text-gray-700 border-gray-200',
};

interface AlumniLocation {
    id: string;
    labelType: LabelType;
    city: string;
    state: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    locationLabel: string;
}

interface LocationManagerProps {
    userId: string;
    disabled?: boolean;
}

const emptyForm = () => ({
    labelType: 'Home' as LabelType,
    city: '',
    state: '',
    country: '',
    latitude: null as number | null,
    longitude: null as number | null,
    locationLabel: '',
});

export const LocationManager: React.FC<LocationManagerProps> = ({ userId, disabled }) => {
    const [locations, setLocations] = useState<AlumniLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState(emptyForm());
    const { toast } = useToast();

    useEffect(() => {
        fetchLocations();
    }, [userId]);

    useEffect(() => {
        if (showForm) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showForm]);

    const fetchLocations = async () => {
        try {
            const res = await fetch('/api/profile/locations', {
                headers: { 'user-id': userId },
            });
            if (res.ok) {
                const data = await res.json();
                setLocations(data.locations || []);
            }
        } catch (err) {
            console.error('Error fetching locations:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.latitude || !formData.longitude) {
            toast({ title: 'Select a location', description: 'Please search and select a location from the suggestions.', variant: 'destructive' });
            return;
        }

        const url = editingId ? `/api/profile/locations/${editingId}` : '/api/profile/locations';
        const method = editingId ? 'PATCH' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'user-id': userId },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                toast({ title: 'Success', description: `Location ${editingId ? 'updated' : 'added'} successfully!` });
                fetchLocations();
                resetForm();
            } else {
                const err = await res.json();
                toast({ title: 'Error', description: err.error || 'Failed to save location', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to save location', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this location?')) return;

        try {
            const res = await fetch(`/api/profile/locations/${id}`, {
                method: 'DELETE',
                headers: { 'user-id': userId },
            });
            if (res.ok) {
                toast({ title: 'Success', description: 'Location deleted successfully!' });
                setLocations(prev => prev.filter(l => l.id !== id));
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to delete location', variant: 'destructive' });
        }
    };

    const handleEdit = (loc: AlumniLocation) => {
        setFormData({
            labelType: loc.labelType,
            city: loc.city,
            state: loc.state,
            country: loc.country,
            latitude: loc.latitude,
            longitude: loc.longitude,
            locationLabel: loc.locationLabel,
        });
        setEditingId(loc.id);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData(emptyForm());
        setEditingId(null);
        setShowForm(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <div className="w-6 h-6 border-4 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                    No locations added yet. Add your Home, University, or Work location to appear on the Alumni Map.
                </p>
            ) : (
                <div className="space-y-2">
                    {locations.map((loc) => (
                        <div key={loc.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 hover:border-[#008060] transition-colors">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${LABEL_COLORS[loc.labelType]}`}>
                                {loc.labelType}
                            </span>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700 truncate">{loc.locationLabel || [loc.city, loc.state, loc.country].filter(Boolean).join(', ')}</span>
                            </div>
                            {!disabled && (
                                <div className="flex gap-1 flex-shrink-0">
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(loc)} className="text-gray-500 hover:text-[#008060] h-7 w-7 p-0">
                                        <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(loc.id)} className="text-gray-500 hover:text-red-600 h-7 w-7 p-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!disabled && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(true)}
                    className="border-dashed border-[#008060] text-[#008060] hover:bg-[#008060]/5"
                >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Location
                </Button>
            )}

            {showForm && (
                <div
                    className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
                    onClick={resetForm}
                >
                    <div
                        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {editingId ? 'Edit Location' : 'Add Location'}
                                </h3>
                                <p className="text-sm text-gray-500">This pin will appear on the Alumni Map</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={resetForm} className="rounded-full hover:bg-gray-100 -mr-2">
                                <X className="w-5 h-5 text-gray-500" />
                            </Button>
                        </div>

                        <form id="location-form" onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="labelType" className="text-sm font-medium">
                                    Location Type <span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="labelType"
                                    value={formData.labelType}
                                    onChange={(e) => setFormData({ ...formData, labelType: e.target.value as LabelType })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    {LABEL_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    Location <span className="text-red-500">*</span>
                                </Label>
                                <CityAutocomplete
                                    city={formData.locationLabel || formData.city}
                                    onCityChange={(val) => setFormData(prev => ({ ...prev, locationLabel: val, latitude: null, longitude: null }))}
                                    onLocationSelect={(city, state, country, lat, lng, label) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            city: city || '',
                                            state: state || '',
                                            country: country || '',
                                            latitude: lat ?? null,
                                            longitude: lng ?? null,
                                            locationLabel: label || [city, state, country].filter(Boolean).join(', '),
                                        }));
                                    }}
                                />
                            </div>
                        </form>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-xl">
                            <Button type="button" variant="outline" onClick={resetForm} className="min-w-[80px]">
                                Cancel
                            </Button>
                            <Button type="submit" form="location-form" variant="brand" className="min-w-[120px]">
                                {editingId ? 'Save Changes' : 'Add Location'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
