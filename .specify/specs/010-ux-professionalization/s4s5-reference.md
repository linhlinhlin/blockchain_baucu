# S4/S5 PRE-gate reference (T029) — BẤT BIẾN, cấm sửa khi refactor US4

Trích **nguyên văn** từ `frontend/src/pages/QuanLySmartContractPage.tsx` TRƯỚC khi tái cấu trúc.
US4 chỉ đổi JSX (return), KHÔNG đụng các vùng dưới đây. T032 sẽ diff lại phải khớp byte-for-byte.

## S4 — type + crypto helpers + S5 owner-check (dòng gốc 176–248)

```ts
// S4 (spec 001): localStorage chi luu envelope da MA HOA, khong luu salt plaintext.
type VoteSecret = Pick<VotePackage, 'candidateId' | 'salt' | 'commitment'>;

type StoredVoteEnvelope = {
  electionAddress: string;
  voter: string;
  candidateName: string;
  committedAt: string;
  revealedAt?: string;
  iv: string;
  ciphertext: string;
};

function buildVotePackageKey(electionAddress: string, walletAddress: string) {
  return `${VOTE_PACKAGE_PREFIX}:${electionAddress.toLowerCase()}:${walletAddress.toLowerCase()}`;
}

// Khoa AES duoc dan xuat tu CHU KY VI -> XSS / may chung khong giai ma duoc neu khong co vi.
function voteEncMessage(electionAddress: string, voter: string) {
  return `HoLiHu ElectionV1 vote secret\nelection: ${electionAddress.toLowerCase()}\nvoter: ${voter.toLowerCase()}`;
}

function bufToB64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function b64ToBytes(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveVoteAesKey(signer: ethers.Signer, electionAddress: string, voter: string) {
  const signature = await signer.signMessage(voteEncMessage(electionAddress, voter));
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
  return window.crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptVoteSecret(key: CryptoKey, secret: VoteSecret) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(secret));
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: bufToB64(iv), ciphertext: bufToB64(ciphertext) };
}

async function decryptVoteSecret(key: CryptoKey, ivB64: string, ciphertextB64: string): Promise<VoteSecret> {
  const plain = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(ivB64) },
    key,
    b64ToBytes(ciphertextB64),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as VoteSecret;
}

function loadStoredVoteEnvelope(electionAddress: string, walletAddress: string): StoredVoteEnvelope | null {
  const raw = window.localStorage.getItem(buildVotePackageKey(electionAddress, walletAddress));
  if (!raw) {
    return null;
  }
  try {
    const env = JSON.parse(raw) as StoredVoteEnvelope;
    // S5: chi chap nhan envelope dung chu so huu (vi) va dung election.
    if (!env || typeof env.ciphertext !== 'string' || typeof env.iv !== 'string') return null;
    if (env.electionAddress?.toLowerCase() !== electionAddress.toLowerCase()) return null;
    if (env.voter?.toLowerCase() !== walletAddress.toLowerCase()) return null;
    return env;
  } catch {
    return null;
  }
}

function saveStoredVoteEnvelope(env: StoredVoteEnvelope) {
  window.localStorage.setItem(buildVotePackageKey(env.electionAddress, env.voter), JSON.stringify(env));
}
```

## S4 — mã hoá SAU commit on-chain (handleCommitVote, gốc 627–644)

```ts
      const tx = await contract.commitVote(commitment, proofPayload.proof);
      await tx.wait();

      // S4: ma hoa secret bang khoa dan xuat tu chu ky vi truoc khi luu localStorage.
      const voteKey = await deriveVoteAesKey(signer, detail.address, address);
      const sealed = await encryptVoteSecret(voteKey, {
        candidateId: candidate.candidateId,
        salt,
        commitment: String(commitment),
      });
      saveStoredVoteEnvelope({
        electionAddress: detail.address,
        voter: address,
        candidateName: candidate.candidateName,
        committedAt: new Date().toISOString(),
        iv: sealed.iv,
        ciphertext: sealed.ciphertext,
      });
```

## S5 — kiểm chủ sở hữu TRƯỚC decrypt/reveal (handleRevealVote, gốc 667–681)

```ts
      const { signer, address } = await getSignerContext();
      const envelope = loadStoredVoteEnvelope(detail.address, address);
      // S5: vote package phai thuoc dung vi dang ket noi.
      if (!envelope || envelope.voter.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Vote package không thuộc ví đang kết nối. Hãy dùng đúng ví và trình duyệt đã commit.');
      }
      let secret: VoteSecret;
      try {
        const voteKey = await deriveVoteAesKey(signer, detail.address, address);
        secret = await decryptVoteSecret(voteKey, envelope.iv, envelope.ciphertext);
      } catch {
        throw new Error('Không giải mã được vote package. Phải dùng đúng ví và trình duyệt đã commit.');
      }
      const contract = new ethers.Contract(detail.address, electionV1Abi, signer);
      const tx = await contract.revealVote(secret.candidateId, secret.salt);
```

**Cách bảo toàn**: US4 tái cấu trúc CHỈ phần `return (...)` JSX. Toàn bộ block 1→~745
(type/helper S4/S5 + handlers commit/reveal/finalize) copy verbatim. T032 = grep/diff
4 vùng trên byte-identical + thứ tự (mã hoá SAU `tx.wait()`; check `voter===address`
TRƯỚC decrypt).
