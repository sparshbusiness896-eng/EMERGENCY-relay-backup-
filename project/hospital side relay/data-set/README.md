# Hospital Emergency Relay - Data Set & Schema Directory

This folder contains the complete, standardized schemas and fictional clinical seed datasets for the **Hospital Emergency Coordination Portal**, modeled according to `DATA_MODEL_AND_API_INTEGRATION.md` and `SECURITY_AND_PRIVACY.md`.

## Directory Structure

```
data-set/
├── schemas/
│   ├── hospital.schema.json      # JSON Schema for hospital facility registration & verification
│   ├── case.schema.json          # JSON Schema for incoming paramedic emergency cases & vitals
│   ├── capacity.schema.json      # JSON Schema for real-time capacity and bed availability snapshots
│   └── audit.schema.json         # JSON Schema for append-only security & privacy audit trails
├── seed/
│   ├── hospitals.json            # Verified facilities (e.g. St. Jude Metropolitan Trauma Center)
│   ├── staff.json                # Hospital staff personas (Admin, Emergency Staff, Coordinator, Auditor)
│   ├── cases.json                # Fictional emergency cases spanning Critical, High, Medium, Low tiers
│   ├── capacity.json             # Real-time bed, ICU, operating room, and bay availability snapshot
│   ├── resources.json            # On-duty specialists, equipment (CT, vents), and blood bank inventory
│   ├── quick_templates.json      # Standard quick instructions dispatched to paramedics
│   └── audit_logs.json           # Sample HIPAA/GDPR compliant audit trail entries
├── index.js                      # Node.js data accessor utility
└── README.md                     # This documentation
```

## Security & Minimization Rules
1. **Synthetic Data**: All names, identification numbers, and contact details are purely fictional.
2. **Minimization**: Patient identities are kept minimal; triage relies on age group, gender, emergency category, and live vitals.
3. **Immutability**: Audit logs and clinical events enforce append-only state progression.
