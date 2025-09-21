import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * 지정된 counter 문서에서 next sequence 값을 채번
 * @param counterName counters/{counterName} 문서 이름
 * @param prefix (optional) ID prefix (ex: "SG", "ME", "NTF")
 * @param padLength (optional) 자리수 (default = 5 → 00001)
 */
export async function getNextCounter(
  counterName: string,
  prefix: string = "",
  padLength: number = 5
): Promise<string> {
  const counterRef = db.collection("counters").doc(counterName);

  const newId = await db.runTransaction(async (tx) => {
    const counterDoc = await tx.get(counterRef);
    const lastSeq = counterDoc.exists ? counterDoc.data()?.last_seq || 0 : 0;
    const nextSeq = lastSeq + 1;

    const padded = String(nextSeq).padStart(padLength, "0");
    const newId = prefix ? `${prefix}${padded}` : padded;

    tx.set(counterRef, { last_seq: nextSeq }, { merge: true });

    return newId;
  });

  return newId;
}
