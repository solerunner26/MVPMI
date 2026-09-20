// Synthetic demonstration data for the development preview. Never use real
// personal data. Idempotent: skips itself once the demo flag is set.
import { randomUUID } from "node:crypto";
import { Store, profile } from "../server/store.mjs";
import {
  enrollAdministrator,
  forwardRequest,
} from "../server/village-approval.mjs";

const dbPath = process.argv[2] || "data/community.sqlite";
const store = new Store(dbPath);
if (store.get("config", "demo-seeded-v1")) {
  console.log("Demo data already seeded in " + dbPath);
  store.db.close();
  process.exit(0);
}

const ADMINISTRATORS = [
  ["થોરાળા", "Thorala", "Jayaben Rathod", "9001000001", "Thorala@2026"],
  ["સથરા", "Sathra", "Rameshbhai Solanki", "9001000002", "Sathra@2026"],
  ["તરેડી", "Taredi", "Manishaben Bhimani", "9001000003", "Taredi@2026"],
  ["લીલવણ", "Lilvan", "Dipakbhai Gohil", "9001000004", "Lilvan@2026"],
  [
    "દૂધાળા નં 1",
    "Dudhala No 1",
    "Saritaben Parmar",
    "9001000005",
    "Dudhala@2026",
  ],
  [
    "તલગાજરડા",
    "Talgajarada",
    "Vijaybhai Chudasama",
    "9001000006",
    "Talgajarada@2026",
  ],
  ["ઝીંજકા", "Zinzaka", "Nitaben Makwana", "9001000007", "Zinzaka@2026"],
];

const MEMBERS = [
  ["Bhavesh Chudasama", "થોરાળા", "9003000001", "9003000002", "Palitana"],
  ["Kiran Solanki", "સથરા", "9003000003", "", "Mahuva town"],
  ["Ashwin Bhimani", "તરેડી", "9003000004", "", ""],
  ["Meera Gohil", "લીલવણ", "9003000005", "9003000006", "Surat, Adajan"],
  ["Sanjay Parmar", "દૂધાળા નં 1", "9003000007", "", ""],
  ["Daxa Chudasama", "તલગાજરડા", "9003000008", "", "Bhavnagar"],
  ["Hardik Makwana", "ઝીંજકા", "9003000009", "9003000010", ""],
  ["Rekha Rathod", "થોરાળા", "9003000011", "", "Vadodara"],
];

const now = Date.now();
store.tx(() => {
  for (const [gu, , name, phone, pass] of ADMINISTRATORS)
    enrollAdministrator(store, {
      village: gu,
      name,
      phone,
      pass,
      reason: "Demo seed administrator",
      actor: "demo-seed",
    });

  const memberIds = {};
  for (const [name, village, phone, phone2, location] of MEMBERS) {
    const id = randomUUID();
    memberIds[name] = id;
    store.put("members", {
      ...profile(
        {
          name,
          nameGu: name,
          phone,
          phone2,
          label2: "work",
          village,
          ...(location ? { currentLocation: location } : {}),
        },
        store.all("villages"),
      ),
      id,
      owner: randomUUID(),
      createdAt: now,
      approvedAt: now,
      approvedBy: "demo-seed",
      consentAt: now,
      consentVersion: "demo-seed-v1",
    });
  }

  const application = (name, village, phone, forwarded = false) => {
    const id = randomUUID();
    store.put("requests", {
      id,
      owner: randomUUID(),
      kind: "new",
      payload: profile(
        { name, nameGu: name, phone, phone2: "", label2: "work", village },
        store.all("villages"),
      ),
      createdAt: now,
      consentAt: now,
      consentVersion: "demo-seed-v1",
      ...(forwarded ? { verification: null } : {}),
    });
    if (forwarded) forwardRequest(store, id, "Demo seed verification");
    return id;
  };
  application("Pending Patelia", "તરેડી", "9002000001");
  application("Forwarded Falia", "સથરા", "9002000002", true);

  // A village-administrator change proposal awaiting the main decision.
  const lilvanAdmin = store.get("villageAdmins", "લીલવણ");
  const meera = store.get("members", memberIds["Meera Gohil"]);
  store.put("requests", {
    id: randomUUID(),
    owner: meera.owner,
    kind: "update",
    memberId: meera.id,
    old: meera,
    payload: { ...meera, currentLocation: "Surat, Piplod" },
    createdAt: now,
    proposedBy: lilvanAdmin.memberId,
    reason: "Demo seed: member moved house",
  });

  // A rejected application retained in the separate ledger.
  const rejectedPayload = profile(
    {
      name: "Unknown Umbre",
      nameGu: "Unknown Umbre",
      phone: "9002000003",
      phone2: "",
      label2: "work",
      village: "ઝીંજકા",
    },
    store.all("villages"),
  );
  store.rejectRequest(
    { id: randomUUID(), owner: randomUUID(), payload: rejectedPayload },
    "reject",
    "Demo seed: not recognised as a community member",
    "demo-seed",
    "village",
    "not-community",
  );

  // A removed member kept once in the archive with full number history.
  const removed = {
    ...profile(
      {
        name: "Moved Mer",
        nameGu: "Moved Mer",
        phone: "9002000004",
        phone2: "",
        label2: "work",
        village: "થોરાળા",
      },
      store.all("villages"),
    ),
    id: randomUUID(),
    owner: randomUUID(),
    createdAt: now,
    approvedAt: now,
    approvedBy: "demo-seed",
    consentAt: now,
    consentVersion: "demo-seed-v1",
  };
  store.put("members", removed);
  store.remove(removed, "ડેમો · Demo seed: member left the community");

  store.put("config", { id: "demo-seeded-v1", at: now });
  store.audit("demo-seed", "demo.seed", dbPath);
});
console.log(
  "Seeded demo village administrators, members and sample requests in " +
    dbPath,
);
store.db.close();
