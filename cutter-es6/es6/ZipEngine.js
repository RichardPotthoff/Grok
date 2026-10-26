/**
 * ZipEngine.js
 * A dependency-free, low-memory ZIP module utilizing native browser Compression Streams.
 */

// Shared CRC-32 Lookup Table for high performance
const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
}

function computeCRC32(uint8Array) {
    let crc = 0 ^ 0xFFFFFFFF;
    for (let i = 0; i < uint8Array.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ uint8Array[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

export class Zip {
    /**
     * Compresses an array of files into a downloadable ZIP Blob.
     * @param {Array<{name: string, content: string|Uint8Array}>} files 
     * @returns {Promise<Blob>}
     */
    static async compress(files) {
        const encoder = new TextEncoder();
        const processedFiles = [];
        
        for (const f of files) {
            const nameBytes = encoder.encode(f.name);
            const uncompressedBytes = typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
            const crc = computeCRC32(uncompressedBytes);

            // Stream compress content natively via deflate-raw
            const stream = new Blob([uncompressedBytes]).stream();
            const compressionStream = new CompressionStream("deflate-raw");
            const compressedStream = stream.pipeThrough(compressionStream);
            const compressedBuffer = await new Response(compressedStream).arrayBuffer();
            const compressedBytes = new Uint8Array(compressedBuffer);

            processedFiles.push({ nameBytes, uncompressedBytes, compressedBytes, crc });
        }

        let totalSize = 0;
        let centralDirSize = 0;
        processedFiles.forEach(f => {
            totalSize += 30 + f.nameBytes.length + f.compressedBytes.length;
            centralDirSize += 46 + f.nameBytes.length;
        });
        totalSize += centralDirSize + 22;

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        const uint8 = new Uint8Array(buffer);
        
        let offset = 0;
        const localHeaderOffsets = [];

        // Write Local File Headers + Compressed Data
        processedFiles.forEach(f => {
            localHeaderOffsets.push(offset);
            view.setUint32(offset, 0x04034b50, true);
            view.setUint16(offset + 4, 20, true);
            view.setUint16(offset + 6, 0, true);
            view.setUint16(offset + 8, 8, true); // DEFLATE
            view.setUint32(offset + 14, f.crc, true);
            view.setUint32(offset + 18, f.compressedBytes.length, true);
            view.setUint32(offset + 22, f.uncompressedBytes.length, true);
            view.setUint16(offset + 26, f.nameBytes.length, true);
            view.setUint16(offset + 28, 0, true);
            
            uint8.set(f.nameBytes, offset + 30);
            uint8.set(f.compressedBytes, offset + 30 + f.nameBytes.length);
            offset += 30 + f.nameBytes.length + f.compressedBytes.length;
        });

        // Write Central Directory Headers
        const centralDirStartOffset = offset;
        processedFiles.forEach((f, index) => {
            view.setUint32(offset, 0x02014b50, true);
            view.setUint16(offset + 4, 20, true);
            view.setUint16(offset + 6, 20, true);
            view.setUint16(offset + 8, 0, true);
            view.setUint16(offset + 10, 8, true);
            view.setUint32(offset + 16, f.crc, true);
            view.setUint32(offset + 20, f.compressedBytes.length, true);
            view.setUint32(offset + 24, f.uncompressedBytes.length, true);
            view.setUint16(offset + 28, f.nameBytes.length, true);
            view.setUint16(offset + 30, 0, true);
            view.setUint16(offset + 32, 0, true);
            view.setUint32(offset + 42, localHeaderOffsets[index], true);
            
            uint8.set(f.nameBytes, offset + 46);
            offset += 46 + f.nameBytes.length;
        });
        const centralDirEndOffset = offset;

        // End of Central Directory Record (EOCD)
        view.setUint32(offset, 0x06054b50, true);
        view.setUint16(offset + 8, files.length, true);
        view.setUint16(offset + 10, files.length, true);
        view.setUint32(offset + 12, centralDirEndOffset - centralDirStartOffset, true);
        view.setUint32(offset + 16, centralDirStartOffset, true);

        return new Blob([buffer], { type: "application/zip" });
    }

    /**
     * Decompresses an uploaded ZIP File or Blob into an array of file objects.
     * @param {Blob|File} zipBlob 
     * @returns {Promise<Array<{name: string, content: Uint8Array}>>}
     */
    static async decompress(zipBlob) {
        const arrayBuffer = await zipBlob.arrayBuffer();
        const view = new DataView(arrayBuffer);
        const uint8 = new Uint8Array(arrayBuffer);
        const decoder = new TextDecoder();
        const extractedFiles = [];

        // Find EOCD Signature
        let eocdOffset = arrayBuffer.byteLength - 22;
        while (eocdOffset >= 0) {
            if (view.getUint32(eocdOffset, true) === 0x06054b50) break;
            eocdOffset--;
        }
        if (eocdOffset < 0) throw new Error("Invalid or unparseable ZIP file structure.");

        const totalEntries = view.getUint16(eocdOffset + 10, true);
        const cdStartOffset = view.getUint32(eocdOffset + 16, true);
        let currentCdOffset = cdStartOffset;

        for (let i = 0; i < totalEntries; i++) {
            if (view.getUint32(currentCdOffset, true) !== 0x02014b50) break;

            const compressionMethod = view.getUint16(currentCdOffset + 10, true);
            const compressedSize = view.getUint32(currentCdOffset + 20, true);
            const fileNameLength = view.getUint16(currentCdOffset + 28, true);
            const extraFieldLength = view.getUint16(currentCdOffset + 30, true);
            const fileCommentLength = view.getUint16(currentCdOffset + 32, true);
            const localHeaderOffset = view.getUint32(currentCdOffset + 42, true);

            const nameStart = currentCdOffset + 46;
            const filePath = decoder.decode(uint8.subarray(nameStart, nameStart + fileNameLength));
            currentCdOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength;

            if (filePath.endsWith("/")) continue;
            if (isJunkZipPath(filePath)) continue;

            const lfhNameLength = view.getUint16(localHeaderOffset + 26, true);
            const lfhExtraLength = view.getUint16(localHeaderOffset + 28, true);
            const payloadStart = localHeaderOffset + 30 + lfhNameLength + lfhExtraLength;
            const compressedPayload = uint8.subarray(payloadStart, payloadStart + compressedSize);

            let decompressedBytes;
            if (compressionMethod === 0) {
                decompressedBytes = compressedPayload;
            } else if (compressionMethod === 8) {
                decompressedBytes = await inflateZip(compressedPayload);
                if (!decompressedBytes) continue;
            } else {
                continue;
            }

            extractedFiles.push({ name: filePath, content: decompressedBytes });
        }
        return extractedFiles;
    }
}

function isJunkZipPath(name) {
    const p = String(name || "").replace(/\\/g, "/");
    if (!p || p.startsWith("__MACOSX/") || p.includes("/__MACOSX/")) return true;
    const base = p.slice(p.lastIndexOf("/") + 1);
    if (base === ".DS_Store" || base.startsWith("._")) return true;
    return false;
}

async function inflateZip(payload) {
    for (const format of ["deflate-raw", "deflate"]) {
        try {
            const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream(format));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        } catch {
            /* try the other wrapper */
        }
    }
    return null;
}
