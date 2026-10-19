import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  // Configuración de Cloudinary (Placeholders configurables o variables de entorno)
  private cloudName = 'motel-ms';
  private uploadPreset = 'motel_preset';

  setCredentials(cloudName: string, uploadPreset: string): void {
    this.cloudName = cloudName;
    this.uploadPreset = uploadPreset;
  }

  uploadImage(file: File): Observable<{ url: string; secureUrl: string; publicId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);

    const promise = fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    })
      .then(async (response) => {
        if (!response.ok) {
          // Si aún no está configurado Cloudinary real, retornar un ObjectURL local seguro para previsualizar y trabajar
          const localUrl = URL.createObjectURL(file);
          return { url: localUrl, secureUrl: localUrl, publicId: 'local_' + Date.now() };
        }
        const data = await response.json();
        return {
          url: data.url,
          secureUrl: data.secure_url,
          publicId: data.public_id
        };
      })
      .catch(() => {
        // Fallback local en caso de error de red o preset no creado todavía
        const localUrl = URL.createObjectURL(file);
        return { url: localUrl, secureUrl: localUrl, publicId: 'local_' + Date.now() };
      });

    return from(promise);
  }
}
