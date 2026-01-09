/**
 * Comprime imagens pesadas no navegador.
 */
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const maxWidth = 1600; // Reduzi um pouco para garantir leveza (HD)
        const quality = 0.7;   // 70% de qualidade é ótimo para web e leve
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Redimensiona mantendo proporção
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Força saída para JPEG (PNG de 24mb continuaria gigante)
                canvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`📉 Compressão: ${(file.size/1024/1024).toFixed(2)}MB -> ${(blob.size/1024/1024).toFixed(2)}MB`);
                        resolve(blob);
                    } else {
                        reject(new Error("Falha ao gerar blob da imagem."));
                    }
                }, 'image/jpeg', quality);
            };

            img.onerror = (err) => reject(new Error("Imagem corrompida ou inválida."));
        };
        
        reader.onerror = (err) => reject(new Error("Erro ao ler o arquivo."));
    });
}