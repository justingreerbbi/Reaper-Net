// crypto.js

const ivLength = 12; // 96-bit IV for AES-GCM
const saltLength = 16; // 128-bit salt for PBKDF2

function getRandomBytes(length) {
	return window.crypto.getRandomValues(new Uint8Array(length));
}

function deriveKey(passphrase, salt) {
	const encoder = new TextEncoder();
	return window.crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]).then((keyMaterial) => {
		return window.crypto.subtle.deriveKey(
			{
				name: "PBKDF2",
				salt: salt,
				iterations: 100000,
				hash: "SHA-256",
			},
			keyMaterial,
			{
				name: "AES-GCM",
				length: 256,
			},
			false,
			["encrypt", "decrypt"]
		);
	});
}
export function generateSecretKey() {
	const bytes = getRandomBytes(40);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function encryptText(plaintext, passphrase) {
	const iv = getRandomBytes(ivLength);
	const salt = getRandomBytes(saltLength);
	const encoder = new TextEncoder();

	return deriveKey(passphrase, salt).then((key) => {
		return window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext)).then((ciphertextBuffer) => {
			const ciphertext = new Uint8Array(ciphertextBuffer);
			const encryptedData = new Uint8Array(salt.length + iv.length + ciphertext.length);
			encryptedData.set(salt, 0);
			encryptedData.set(iv, salt.length);
			encryptedData.set(ciphertext, salt.length + iv.length);

			return btoa(String.fromCharCode(...encryptedData));
		});
	});
}

export function decryptText(base64Ciphertext, passphrase) {
	const encryptedData = Uint8Array.from(atob(base64Ciphertext), (c) => c.charCodeAt(0));
	const salt = encryptedData.slice(0, saltLength);
	const iv = encryptedData.slice(saltLength, saltLength + ivLength);
	const ciphertext = encryptedData.slice(saltLength + ivLength);

	return deriveKey(passphrase, salt).then((key) => {
		return window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext).then((decryptedBuffer) => {
			const decoder = new TextDecoder();
			return decoder.decode(decryptedBuffer);
		});
	});
}
