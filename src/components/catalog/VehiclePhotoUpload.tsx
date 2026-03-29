import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, X, Upload, Image } from "lucide-react";

interface Props {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  vehicleId?: string;
}

const VehiclePhotoUpload = ({ photos, onPhotosChange, vehicleId }: Props) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${vehicleId || "temp"}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("vehicle-photos")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("vehicle-photos")
        .getPublicUrl(data.path);

      const newPhotos = [...photos, urlData.publicUrl];
      onPhotosChange(newPhotos);
      toast.success("Foto enviada!");
    } catch (e: any) {
      toast.error(`Erro ao enviar foto: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadPhoto(file);
    }
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {photos.map((url, i) => (
          <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border">
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors cursor-pointer"
        >
          {uploading ? (
            <span className="text-sm text-muted-foreground">Enviando...</span>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Adicionar foto</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground">
        Dica: Tire fotos da moto de frente, lateral, traseira e painel. As fotos ficam visíveis no catálogo público e para a IA no chat.
      </p>
    </div>
  );
};

export default VehiclePhotoUpload;
