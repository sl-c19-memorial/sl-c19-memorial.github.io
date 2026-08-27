# Submission form — fields to recreate in Google Forms

The original submission form (`memorial-web`) had three sections. Recreate it in
Google Forms, then paste the form's share link into `hugo.toml` →
`params.submitFormUrl`. Turn on **Settings → Responses → Collect email
addresses** and **Send responders a copy** so submitters get a receipt.

The wording below is verbatim from the original site (`lang/en.json` →
`submitForm`). Sinhala/Tamil equivalents are in `lang/si.json` / `lang/ta.json`
of the archived `memorial-web` repo if you want a multilingual form.

---

## Section 1 — Before you begin

*Section description:* the three statements below; the submitter must agree to
all of them.

1. I hereby confirm that I'm a family member of the deceased or that the family
   of the deceased have given me their permission to make this submission on
   their behalf.
2. I have documents that can verify the information I'm submitting (ex- death
   certificate or obituary).
3. I hereby allow the team of Sri Lanka COVID-19 Memorial to store and process
   this data for the purpose of verifying the information submitted by me.

| Field | Type | Required |
| --- | --- | --- |
| I agree to the above prerequisites | Checkbox (single option) | Yes |

---

## Section 2 — Details of the deceased person

*Section description:* Please share with us the following details about the
deceased person. The mandatory details will be displayed on the memorial
website and the name will be displayed only if you give consent below.

| # | Field label | Type | Required | Notes / maps to |
| --- | --- | --- | --- | --- |
| 1 | Age of the deceased person | Short answer, number validation | Yes | `ageValue` |
| 2 | Gender of the deceased person | Multiple choice: Male / Female | Yes | `gender` |
| 3 | Village or city the deceased person was from | Short answer | Yes | `city` (+ derive `district` / `province`) |
| 4 | Date of death | Date | Yes | `deathDate` |
| 5 | Name of the deceased person | Short answer | No | `detail.name` |
| 6 | Display their name on the memorial website | Multiple choice: Yes / No | Yes | controls whether `detail.name` is published |
| 7 | Occupation of the deceased person | Short answer | No | `detail.occupation` |
| 8 | Photograph of person | File upload (image, 1 file) | No | `detail.photo` → vendored into `assets/people/` |
| 9 | Anything else you want to share about the deceased person | Paragraph | No | `detail.description` |

---

## Section 3 — Verification of details

*Section description:* These details are only for our reference. They will not
be displayed on the memorial website or published or shared beyond our team.

| # | Field label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| 1 | Upload Death Certificate / any other proof | File upload | No (recommended) | private |
| 2 | Your Name | Short answer | Yes | submitter |
| 3 | Your Email | Short answer, email validation | Yes | submitter (or use "Collect email addresses") |
| 4 | Phone Number (if unreachable via email) | Short answer | No | submitter |

---

## After a submission

Responses land in the linked Google Sheet. To publish one, a maintainer adds a
row to `data/covid19_deaths.json` with:

- `indexKey` / `slug` — `YYYY-MM-DD-NNNN` for the date of death
- `deathDate`, `province`, `district`, `city`, `ageType: "FINE"`, `ageValue`,
  `gender`, `deathPlace` (optional), `incarcerated: false`
- `sourceType: "VERIFIED_SUBMISSION"`, `sourceRef: ""`
- `detail: { "name": …|null, "occupation": …|null, "description": …|null, "photo": "people/<slug>.jpg"|null }`

Drop the photo file into `assets/people/<slug>.jpg`, commit, and the build
regenerates that person's page. File-upload links from Forms are Drive URLs, so
download the image and commit it rather than hot-linking.
