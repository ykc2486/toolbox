import { argon2id } from 'hash-wasm';
import { zipSync, unzipSync } from 'fflate';

const MAGIC_ENCRYPTED = new Uint8Array([0x4e, 0x49, 0x47, 0x41]);

const MAGIC_ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

async function deriveKey(
	password: string,
	salt: Uint8Array,
	iterations: number = 3,
	memory: number = 65536
): Promise<CryptoKey> {
	const derivedKey = await argon2id({
		password: password,
		salt: salt,
		iterations: iterations,
		memorySize: memory,
		parallelism: 1,
		hashLength: 32, // For AES-256, we need 32 bytes key
		outputType: 'binary'
	});

	return await crypto.subtle.importKey(
		'raw',
		derivedKey as BufferSource,
		{ name: 'AES-GCM' },
		false,
		['encrypt', 'decrypt']
	);
}

export async function encryptFiles(
	files: { name: string; data: ArrayBuffer }[],
	password?: string
): Promise<ArrayBuffer> {
	let totalSize = 0;
	for (const file of files) {
		totalSize += file.data.byteLength;
	}
	if (totalSize > MAX_FILE_SIZE) {
		throw new Error('File size exceeds 100MB limit.');
	}

	// zip all files
	const zipStructure: Record<string, Uint8Array> = {};
	for (const file of files) {
		zipStructure[file.name] = new Uint8Array(file.data);
	}
	const zippedData = zipSync(zipStructure);

	if (zippedData.byteLength > MAX_FILE_SIZE) {
		throw new Error('File size exceeds 100MB limit.');
	}

	if (!password || password.trim() === '') {
		// no pwd, only for zip
		return zippedData.buffer.slice(
			zippedData.byteOffset,
			zippedData.byteOffset + zippedData.byteLength
		);
	}

	// encryption
	const salt = crypto.getRandomValues(new Uint8Array(16)); // 16 bytes salt for argon2id
	const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes iv for AES256 GCM

	const key = await deriveKey(password, salt, 3, 65536);

	const encryptedData = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: iv
		},
		key,
		zippedData
	);

	const ciphertext = new Uint8Array(encryptedData);

	const totalLength = MAGIC_ENCRYPTED.length + salt.length + iv.length + ciphertext.length;
	if (totalLength > MAX_FILE_SIZE) {
		throw new Error('File size exceeds 100MB limit.');
	}

	// combine metadata and cipher text
	const result = new Uint8Array(totalLength);
	let offset = 0;

	result.set(MAGIC_ENCRYPTED, offset);
	offset += MAGIC_ENCRYPTED.length;

	result.set(salt, offset);
	offset += salt.length;

	result.set(iv, offset);
	offset += iv.length;

	result.set(ciphertext, offset);

	return result.buffer;
}

export async function decryptFiles(
	buffer: ArrayBuffer,
	password?: string
): Promise<{ name: string; data: ArrayBuffer }[]> {
	if (buffer.byteLength > MAX_FILE_SIZE) {
		throw new Error('File size exceeds 100MB limit.');
	}

	const fullData = new Uint8Array(buffer);

	if (fullData.length < 4) {
		throw new Error('File is too short to determine its type.');
	}

	const isEncrypted =
		fullData[0] === MAGIC_ENCRYPTED[0] &&
		fullData[1] === MAGIC_ENCRYPTED[1] &&
		fullData[2] === MAGIC_ENCRYPTED[2] &&
		fullData[3] === MAGIC_ENCRYPTED[3];

	const isRawZip =
		fullData[0] === MAGIC_ZIP[0] &&
		fullData[1] === MAGIC_ZIP[1] &&
		fullData[2] === MAGIC_ZIP[2] &&
		fullData[3] === MAGIC_ZIP[3];

	let zippedData: Uint8Array;

	if (isRawZip) {
		// standard zip file, no password needed
		zippedData = fullData;
	} else if (isEncrypted) {
		// encrypted file, password is required
		if (!password || password.trim() === '') {
			throw new Error('This file requires a password.');
		}

		// Check if the data length is sufficient for salt, iv, and at least some ciphertext
		if (fullData.length < 32) {
			throw new Error('The header is broken.');
		}

		let offset = MAGIC_ENCRYPTED.length;
		const salt = fullData.subarray(offset, offset + 16);
		offset += 16;
		const iv = fullData.subarray(offset, offset + 12);
		offset += 12;
		const ciphertext = fullData.subarray(offset);

		// deriving key and decrypting
		const key = await deriveKey(password, salt, 3, 65536);
		const decryptedData = await crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: iv
			},
			key,
			ciphertext
		);

		zippedData = new Uint8Array(decryptedData);
	} else {
		throw new Error('Unknown file format.');
	}

	const unzipped = unzipSync(zippedData);

	return Object.entries(unzipped).map(([name, data]) => {
		const fileBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
		return {
			name,
			data: fileBuffer
		};
	});
}
