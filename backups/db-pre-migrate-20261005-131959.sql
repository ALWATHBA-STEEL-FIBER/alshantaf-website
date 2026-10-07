--
-- PostgreSQL database dump
--

\restrict iCI8Meend5d9qB1wbQy04EcFwfYyYIfiq5UNTvg7kf7qwat8Y6jZOSrPIsUGAuk

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ContactRequestStatus; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."ContactRequestStatus" AS ENUM (
    'new',
    'contacted',
    'closed'
);


ALTER TYPE public."ContactRequestStatus" OWNER TO alshantaf;

--
-- Name: DealType; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."DealType" AS ENUM (
    'sale',
    'rent',
    'sale_or_rent',
    'partnership'
);


ALTER TYPE public."DealType" OWNER TO alshantaf;

--
-- Name: IndustryType; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."IndustryType" AS ENUM (
    'light',
    'medium',
    'technical',
    'lightSpecial',
    'mediumSpecial',
    'agriToIndustrial',
    'residentialA',
    'residentialB',
    'residentialC',
    'residentialD',
    'residentialGreen',
    'residentialAgri',
    'agriFacilities',
    'commercialCentral',
    'commercialShowrooms',
    'commercialLinear',
    'commercialLocal',
    'greenWithinA',
    'greenWithinB',
    'greenWithinC',
    'greenWithinD',
    'residentialPrivateA',
    'residentialPrivateB',
    'residentialRural',
    'commercialOrdinaryA',
    'commercialOrdinaryB',
    'commercialOrdinaryC',
    'commercialWithinD',
    'commercialComplex',
    'commercialOutsideCentral',
    'commercialOutsideShowrooms',
    'commercialOutsideLinear',
    'commercialOutsideLocal',
    'industrialCraft',
    'industrialHeavy',
    'industrialTransformative',
    'commercialOffice',
    'commercialIndustrial',
    'commercialNeighborhoodService',
    'commercialCenter',
    'mixedUse',
    'mixedUseEntertainment',
    'residentialPrivateC'
);


ALTER TYPE public."IndustryType" OWNER TO alshantaf;

--
-- Name: LandCheckStatus; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."LandCheckStatus" AS ENUM (
    'new',
    'contacted',
    'closed'
);


ALTER TYPE public."LandCheckStatus" OWNER TO alshantaf;

--
-- Name: MediaKind; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."MediaKind" AS ENUM (
    'image',
    'video',
    'document'
);


ALTER TYPE public."MediaKind" OWNER TO alshantaf;

--
-- Name: PresenterRole; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."PresenterRole" AS ENUM (
    'owner',
    'presenter',
    'broker',
    'company',
    'other'
);


ALTER TYPE public."PresenterRole" OWNER TO alshantaf;

--
-- Name: PropertyStatus; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."PropertyStatus" AS ENUM (
    'available',
    'reserved',
    'sold',
    'rented',
    'canceled'
);


ALTER TYPE public."PropertyStatus" OWNER TO alshantaf;

--
-- Name: PublishStatus; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."PublishStatus" AS ENUM (
    'published',
    'draft',
    'archived'
);


ALTER TYPE public."PublishStatus" OWNER TO alshantaf;

--
-- Name: SubmissionSource; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."SubmissionSource" AS ENUM (
    'owner',
    'broker'
);


ALTER TYPE public."SubmissionSource" OWNER TO alshantaf;

--
-- Name: SubmissionStatus; Type: TYPE; Schema: public; Owner: alshantaf
--

CREATE TYPE public."SubmissionStatus" AS ENUM (
    'pending',
    'duplicate_review',
    'needs_info',
    'approved',
    'rejected'
);


ALTER TYPE public."SubmissionStatus" OWNER TO alshantaf;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "actorEmail" text NOT NULL,
    action text NOT NULL,
    "targetType" text,
    "targetId" text,
    metadata jsonb,
    ip text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO alshantaf;

--
-- Name: ContactRequest; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."ContactRequest" (
    id text NOT NULL,
    "serialNo" text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    "requestType" text NOT NULL,
    "industryType" text,
    "activityType" text,
    details text NOT NULL,
    status public."ContactRequestStatus" DEFAULT 'new'::public."ContactRequestStatus" NOT NULL,
    "adminNotes" text,
    reviewer text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ContactRequest" OWNER TO alshantaf;

--
-- Name: LandCheck; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."LandCheck" (
    id text NOT NULL,
    "serialNo" text NOT NULL,
    name text,
    phone text,
    email text,
    governorate text,
    directorate text,
    village text,
    basin text,
    neighborhood text,
    parcel text,
    coordinates text,
    latitude double precision,
    longitude double precision,
    address text,
    "dlsKey" text,
    "areaSqm" double precision,
    "areaLabel" text,
    "administrativeValue" double precision,
    "administrativeValueSource" text,
    "administrativeValueAt" timestamp(3) without time zone,
    "estimatedMedian" double precision,
    "industryType" public."IndustryType",
    notes text,
    status public."LandCheckStatus" DEFAULT 'new'::public."LandCheckStatus" NOT NULL,
    "adminNotes" text,
    reviewer text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "clientKey" text,
    "isDraft" boolean DEFAULT false NOT NULL,
    "perimeterM" double precision,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LandCheck" OWNER TO alshantaf;

--
-- Name: Listing; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."Listing" (
    id text NOT NULL,
    "listingNo" text NOT NULL,
    title text NOT NULL,
    area text NOT NULL,
    "propertyType" text,
    "industryType" public."IndustryType" NOT NULL,
    "dealType" public."DealType" DEFAULT 'sale'::public."DealType" NOT NULL,
    size text,
    price text,
    basin text,
    parcel text,
    "locationUrl" text,
    phone text,
    status public."PropertyStatus" DEFAULT 'available'::public."PropertyStatus" NOT NULL,
    "publishStatus" public."PublishStatus" DEFAULT 'draft'::public."PublishStatus" NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    "presenterRole" public."PresenterRole",
    "presenterName" text,
    "showPresenter" boolean DEFAULT false NOT NULL,
    description text NOT NULL,
    "internalNotes" text,
    "mainImage" text,
    source text DEFAULT 'admin'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "viewCount" integer DEFAULT 0 NOT NULL,
    governorate text,
    village text,
    neighborhood text,
    directorate text,
    "administrativeValue" double precision,
    "administrativeValueSource" text,
    "administrativeValueAt" timestamp(3) without time zone,
    latitude double precision,
    longitude double precision,
    address text,
    "ownerAccessCode" text,
    "smsOptIn" boolean DEFAULT true NOT NULL,
    "notifiedMilestones" integer[] DEFAULT ARRAY[]::integer[],
    "showEstimatedValue" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."Listing" OWNER TO alshantaf;

--
-- Name: ListingView; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."ListingView" (
    id text NOT NULL,
    "listingId" text NOT NULL,
    "visitorId" text NOT NULL,
    "viewedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ListingView" OWNER TO alshantaf;

--
-- Name: Media; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."Media" (
    id text NOT NULL,
    "listingId" text NOT NULL,
    url text NOT NULL,
    kind public."MediaKind" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Media" OWNER TO alshantaf;

--
-- Name: Setting; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."Setting" (
    key text NOT NULL,
    value text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Setting" OWNER TO alshantaf;

--
-- Name: StandbyImage; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."StandbyImage" (
    id text NOT NULL,
    url text NOT NULL,
    title text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."StandbyImage" OWNER TO alshantaf;

--
-- Name: Submission; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    source public."SubmissionSource" NOT NULL,
    applicant text NOT NULL,
    phone text NOT NULL,
    office text,
    whatsapp text,
    email text,
    "authExpiry" text,
    governorate text,
    village text,
    basin text,
    parcel text,
    neighborhood text,
    coordinates text,
    area text,
    price text,
    "industryType" public."IndustryType",
    activity text,
    details text NOT NULL,
    duplicate boolean DEFAULT false NOT NULL,
    status public."SubmissionStatus" DEFAULT 'pending'::public."SubmissionStatus" NOT NULL,
    reviewer text,
    "reviewNote" text,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reviewedAt" timestamp(3) without time zone,
    "convertedListingId" text,
    document text,
    images text[] DEFAULT ARRAY[]::text[],
    video text,
    "serialNo" text NOT NULL,
    "trackingCode" text NOT NULL,
    directorate text,
    latitude double precision,
    longitude double precision,
    address text,
    "administrativeValue" double precision,
    "administrativeValueSource" text,
    "administrativeValueAt" timestamp(3) without time zone,
    "dlsKey" text
);


ALTER TABLE public."Submission" OWNER TO alshantaf;

--
-- Name: User; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    phone text,
    whatsapp text,
    permissions text[] DEFAULT ARRAY['*'::text] NOT NULL
);


ALTER TABLE public."User" OWNER TO alshantaf;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: alshantaf
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO alshantaf;

--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."AuditLog" (id, "actorEmail", action, "targetType", "targetId", metadata, ip, "createdAt") FROM stdin;
b35bd26d-56e3-4c46-8c06-01c76fd5232e	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.73	2026-09-14 16:02:12.52
8411c61b-4ae8-461b-a285-07c7427a3a99	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.73	2026-09-14 16:02:37.562
102cb2b5-4479-4a37-af64-7d6a77b24820	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.73	2026-09-14 16:04:14.534
8568e14f-deee-471b-9afe-160f8b2d6183	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.73	2026-09-14 16:05:19.649
4763bfe0-bf8f-44cc-b683-871bcabbe475	ahmed@alwathbasteelfiber.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"status": "approved", "reviewer": "Alshantaf Admin"}	149.200.255.73	2026-09-14 16:06:00.427
2f823e9d-3325-4ecf-b178-7798c50ed724	ahmed@alwathbasteelfiber.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"status": "approved", "reviewer": "Alshantaf Admin"}	149.200.255.73	2026-09-14 16:06:25.009
5cbc3cf3-b041-40e8-868c-49f027fe50df	ahmed@alwathbasteelfiber.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"status": "approved", "reviewer": "Alshantaf Admin"}	149.200.255.73	2026-09-14 16:06:25.383
63f3f869-290f-4258-bf6a-e6a95be9fc91	ahmed@alwathbasteelfiber.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"status": "rejected", "reviewer": "Alshantaf Admin"}	149.200.255.73	2026-09-14 16:07:33.823
dbf9764b-dfae-43eb-9a7d-e2b48c0fdb2e	ahmed@alwathbasteelfiber.com	submission.update	submission	1b6e6b58-81b9-4d71-98ae-ade298739b09	{"status": "approved", "reviewer": "Alshantaf Admin"}	149.200.255.73	2026-09-14 16:07:40.686
d36fbef0-d2ce-44f1-9f4f-de99b95a3e36	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	176.29.160.150	2026-09-15 06:13:09.903
54c9cacb-3d38-49ee-b64d-8de540817abb	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 07:47:57.845
bd066786-8be1-43aa-a0a3-a41a070ab6af	ahmed@alwathbasteelfiber.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"status": "rejected", "reviewer": "Alshantaf Admin"}	149.200.255.6	2026-09-15 07:48:09.073
c650134a-a13c-4f8f-ac41-eb455330dc23	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 08:00:46.579
0546fe9f-bbf3-4a7e-85de-18552c57a4ee	ahmed@alwathbasteelfiber.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"status": "approved", "reviewer": "Alshantaf Admin"}	149.200.255.6	2026-09-15 08:02:21.306
40499322-5993-429c-a39a-b59c50d1e03a	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 08:13:19.123
5f79421c-4016-445b-a16a-1f9b9635baad	ahmed@alwathbasteelfiber.com	submission.approve	submission	1b6e6b58-81b9-4d71-98ae-ade298739b09	{"listingId": "54b395c1-6dc2-4ef9-9e5a-9fc9141286b7", "listingNo": "SH-OTH-0001", "published": false, "imageCount": 1, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	149.200.255.6	2026-09-15 08:13:59.187
49e2cfe0-b1eb-4748-90c3-9b5e83ad8ba9	ahmed@alwathbasteelfiber.com	listing.publish	listing	54b395c1-6dc2-4ef9-9e5a-9fc9141286b7	{"publishStatus": "published"}	149.200.255.6	2026-09-15 08:14:25.119
7798d832-de51-47c1-ab84-e686b100b1fa	ahmed@alwathbasteelfiber.com	listing.unpublish	listing	54b395c1-6dc2-4ef9-9e5a-9fc9141286b7	{"publishStatus": "draft"}	149.200.255.6	2026-09-15 08:14:26.352
69735906-0296-4569-bcf0-bccf8a93d482	ahmed@alwathbasteelfiber.com	listing.publish	listing	54b395c1-6dc2-4ef9-9e5a-9fc9141286b7	{"publishStatus": "published"}	149.200.255.6	2026-09-15 08:15:54.77
46155ba2-d626-4d0f-8c69-f78e5b0a6ccb	ahmed@alwathbasteelfiber.com	listing.update	listing	54b395c1-6dc2-4ef9-9e5a-9fc9141286b7	\N	149.200.255.6	2026-09-15 08:16:21.211
bfc66de2-941e-4ca3-82e9-8465078fedcc	admin@alshantaf.com	auth.login_failed	\N	\N	\N	149.200.255.6	2026-09-15 09:04:20.762
9174cef7-7472-4237-a667-4ca323c5abed	admin@alshantaf.com	auth.login_failed	\N	\N	\N	149.200.255.6	2026-09-15 09:05:30.855
c8311411-b296-44f9-acdf-841c48e5659f	admin@alshantaf.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 09:05:53.452
015d3038-18fa-4bca-bc76-42854050a960	admin@alshantaf.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "status": "needs_info", "village": "al qastal", "reviewer": "Alshantaf Admin", "applicant": "waleed najim"}	149.200.255.6	2026-09-15 09:06:14.49
de37dc84-8bfb-449e-837d-d1b9ee8ff61f	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 10:03:51.75
0bd4b4af-299e-4b65-8b03-333d6ef5db9a	ahmed@alwathbasteelfiber.com	listing.unpublish	listing	54b395c1-6dc2-4ef9-9e5a-9fc9141286b7	{"publishStatus": "draft"}	149.200.255.6	2026-09-15 10:05:37.833
a0d5c663-14de-476d-ac05-e5743e06e0fc	ahmed@alwathbasteelfiber.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "status": "rejected", "village": "al qastal", "reviewer": "Alshantaf Admin", "applicant": "waleed najim"}	149.200.255.6	2026-09-15 10:16:52.557
aa58529a-6be5-4643-9c74-cd4630ac1810	ahmed@alwathbasteelfiber.com	submission.update	submission	1b6e6b58-81b9-4d71-98ae-ade298739b09	{"parcel": "9", "status": "rejected", "village": "تجريبي", "reviewer": "Alshantaf Admin", "applicant": "Prod Test"}	149.200.255.6	2026-09-15 10:16:55.824
b6a253fb-dc44-4e10-864d-4fb49cba068e	ahmed@alwathbasteelfiber.com	submission.update	submission	1cf7d931-2753-44f8-b740-541eac5bd424	{"parcel": null, "status": "rejected", "village": null, "reviewer": "Alshantaf Admin", "applicant": "x"}	149.200.255.6	2026-09-15 10:16:57.378
7757c739-7a07-4ddd-88e1-062853576746	ahmed@alwathbasteelfiber.com	listing.delete	listing	54b395c1-6dc2-4ef9-9e5a-9fc9141286b7	{"title": "أرض صناعية في تجريبي", "listingNo": "SH-OTH-0001"}	149.200.255.6	2026-09-15 10:17:03.28
b773bb5e-e9eb-46f5-ba9b-4fe75142b33c	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 11:17:20.671
e2285203-317b-4a84-bdc0-59b9f26be1ab	ahmed@alwathbasteelfiber.com	submission.approve	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "village": "al qastal", "applicant": "waleed najim", "listingId": "d285c447-47a9-4657-83c0-65ddd021c6ea", "listingNo": "SH-OTH-0001", "published": true, "imageCount": 0, "includePrice": true, "includeVideo": true, "includeParcel": false, "includeDocument": false}	149.200.255.6	2026-09-15 11:18:48.61
e697a222-60a4-4b32-b954-d5ba7eb08aa7	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 12:40:50.693
f05b8863-2888-4cfe-8f2b-bdd5fff46a85	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 12:41:23.754
1c4ff420-953e-4db3-8b5f-b70190680b46	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 13:03:41.33
74d7ab3e-4e86-4a0f-8d31-a74e91a47d42	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 14:09:54.758
91032e98-7576-4fa4-af8d-191b768e33f8	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 15:02:09.329
a8858666-abc0-4e85-9fcd-5ffa8092c741	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 15:10:03.943
0dc157e4-62fb-4d49-b011-53ac9ac53afa	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 15:15:34.059
dfab62b8-3c4e-4cda-9dd6-5a41aee3c7d3	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 15:21:43.482
4b2162f6-c25c-4ed5-89b7-3ea239eff00f	ahmed@alwathbasteelfiber.com	media.delete	file	2586dc32-d0f8-48bc-9d5c-3b1989ffb023.jpeg	\N	149.200.255.6	2026-09-15 15:25:21.456
f83d498e-fb70-4039-87e5-c9de9c5ed6b5	ahmed@alwathbasteelfiber.com	media.delete	file	970755a5-2a95-4c47-af1a-da362a935452.jpeg	\N	149.200.255.6	2026-09-15 15:25:24.386
8100cc02-d442-44c4-91a5-84dcdb18817f	ahmed@alwathbasteelfiber.com	media.delete	file	8473f2ab-b238-40ed-9fdf-7f2a94ed9b5a.pdf	\N	149.200.255.6	2026-09-15 15:25:30.082
c2658e25-fad7-4e42-acd4-fcd6d5ac1968	ahmed@alwathbasteelfiber.com	media.delete	file	74e0ef26-93ae-4019-ab01-742d0a5abfc7.jpeg	\N	149.200.255.6	2026-09-15 15:25:26.875
0c938b4f-cb09-40ea-aed5-b5b3ec497cf1	ahmed@alwathbasteelfiber.com	admin_user.create	user	bfdf8f0e-be00-479c-9f5f-c2db1e9db980	{"email": "ahmed@alshantaf.com"}	149.200.255.6	2026-09-15 15:28:17.156
85b21a47-4b21-4d76-aa74-bdf3ae25ad62	ahmad@alshantaf.com	auth.login_failed	\N	\N	\N	149.200.255.6	2026-09-15 15:30:57.966
3cff85c4-913d-41ff-a5dd-4c23a1622247	ahmed@alwathbasteelfiber.com	admin_user.delete	user	bfdf8f0e-be00-479c-9f5f-c2db1e9db980	{"email": "ahmed@alshantaf.com"}	149.200.255.6	2026-09-15 15:33:30.249
81a9c322-31a5-4bd6-a4c0-b473ad00b976	ahmed@alwathbasteelfiber.com	admin_user.create	user	5bb64949-c216-4876-8a75-61be3aaa3771	{"email": "ahmad@alshantaf.com"}	149.200.255.6	2026-09-15 15:33:48.64
be58a8de-a543-4f93-a9ea-ba83dbdae0c7	ahmad@alshantaf.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 15:33:51.902
c3ef6830-40c2-4a77-9944-20e02e030a43	ahmad@alshantaf.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "status": "needs_info", "village": "al qastal", "reviewer": "Alshantaf Admin", "applicant": "waleed najim"}	149.200.255.6	2026-09-15 15:34:16.871
91aef2e5-84be-4748-ae6c-29a461de7b74	ahmad@alshantaf.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 15:37:49.712
32943e3c-a43c-402b-9aa1-b6786b1756ff	ahmad@alshantaf.com	listing.feature	listing	d285c447-47a9-4657-83c0-65ddd021c6ea	\N	149.200.255.6	2026-09-15 15:38:44.226
bc4cb7d6-584b-4dc9-a5d3-95fa1771fb2a	ahmad@alshantaf.com	auth.login	\N	\N	\N	149.200.255.6	2026-09-15 15:40:12.779
e8a01994-d3bd-49d8-8c5b-dbc8639fcef0	ahmad@alshantaf.com	listing.update	listing	d285c447-47a9-4657-83c0-65ddd021c6ea	\N	149.200.255.6	2026-09-15 17:15:31.441
169c4262-d877-4b76-b229-13d4b384a05f	ahmad@alshantaf.com	listing.update	listing	d285c447-47a9-4657-83c0-65ddd021c6ea	\N	149.200.255.6	2026-09-15 17:18:20.189
5391ef41-f091-4436-b042-7eaf4913b374	ahmad@alshantaf.com	settings.update	\N	\N	{"after": {"facebookUrl": "https://facebook.com/Alshantaf.RealeEstate", "contactEmail": "ahmed@alshantaf.com", "contactPhone1": "+962 79 999 6668", "contactPhone2": "+962 79 999 6660", "whatsappNumber": "962799996668", "maintenanceBanner": "", "submissionsEnabled": "true"}, "before": {"facebookUrl": "https://facebook.com/Alshantaf.RealeEstate", "contactEmail": "ahmed@alshantaf.com", "contactPhone1": "+962 79 999 6668", "contactPhone2": "+962 79 999 6660", "whatsappNumber": "962799996668", "maintenanceBanner": "", "submissionsEnabled": "true"}}	149.200.255.6	2026-09-15 17:19:35.646
8c69544a-51ec-4e67-8fdc-79d9043be89a	ahmad@alshantaf.com	settings.update	\N	\N	{"after": {"facebookUrl": "https://facebook.com/Alshantaf.RealeEstate", "contactEmail": "ahmed@alshantaf.com", "contactPhone1": "+962 79 999 6668", "contactPhone2": "+962 79 999 6660", "whatsappNumber": "962799996668", "maintenanceBanner": "", "submissionsEnabled": "true"}, "before": {"facebookUrl": "https://facebook.com/Alshantaf.RealeEstate", "contactEmail": "ahmed@alshantaf.com", "contactPhone1": "+962 79 999 6668", "contactPhone2": "+962 79 999 6660", "whatsappNumber": "962799996668", "maintenanceBanner": "", "submissionsEnabled": "true"}}	149.200.255.6	2026-09-15 17:24:09.613
36c39027-b0b4-4617-a3ef-241d809add39	ahmad@alshantaf.com	listing.update	listing	d285c447-47a9-4657-83c0-65ddd021c6ea	\N	149.200.255.6	2026-09-15 17:41:43.074
23833fed-4c68-4d51-8b09-c940ee0583f8	ahmad@alshantaf.com	listing.update	listing	d285c447-47a9-4657-83c0-65ddd021c6ea	\N	149.200.255.6	2026-09-15 17:42:38.021
93d5b41f-0d7f-45ce-a9e7-61de37e8b851	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.4	2026-09-16 08:23:16.502
c0dc6515-6cd4-45ae-8f38-6fde62b08b6d	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.4	2026-09-16 09:13:08.845
2de0cb33-511b-44a2-a98f-23d7b119848c	admin@alshantaf.com	auth.login	\N	\N	\N	149.200.255.4	2026-09-16 13:20:47.609
b09ec12a-b6f4-465a-97cb-379ba40c3377	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	149.200.255.4	2026-09-16 14:00:27.161
cc95378d-9721-49e4-88a2-ebb769c1c438	ahmed@alshantafsteelfiber.com	auth.login_failed	\N	\N	\N	149.200.255.4	2026-09-16 14:39:45.25
14058a88-08d9-4438-a31f-4df043a05159	ahmed@alshantafsteelfiber.com	auth.login_failed	\N	\N	\N	149.200.255.4	2026-09-16 14:40:54.967
7c58164d-f965-4c83-99f7-59723a7e945c	ahmed@alshantafsteelfiber.com	auth.login_failed	\N	\N	\N	149.200.255.4	2026-09-16 14:40:57.015
b366c18d-d75c-4685-bb84-54a8cc7578a7	ahmed@alshantafsteelfiber.com	auth.login_failed	\N	\N	\N	149.200.255.4	2026-09-16 14:40:59.147
4d22980a-0561-4a14-b3e2-2ea9e62bc7da	ahmed@alshantafsteelfiber.com	auth.login_failed	\N	\N	\N	149.200.255.4	2026-09-16 14:41:42.004
bbc421f0-daf3-4ab5-819c-7be001ae1722	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	176.29.3.233	2026-09-16 14:42:26.473
1856af47-9398-4195-afd5-5f1fc4774a6e	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	86.108.45.245	2026-09-17 13:43:05.269
97c0914b-55be-4ad1-84fa-442898c62085	ahmed@alwathbasteelfiber.com	settings.update	\N	\N	{"after": {"facebookUrl": "https://facebook.com/Alshantaf.RealeEstate", "contactEmail": "ahmad@alshantaf.com", "contactPhone1": "+962 79 999 6668", "contactPhone2": "+962 79 999 6660", "whatsappNumber": "962799996668", "maintenanceBanner": "", "submissionsEnabled": "true"}, "before": {"facebookUrl": "https://facebook.com/Alshantaf.RealeEstate", "contactEmail": "ahmed@alshantaf.com", "contactPhone1": "+962 79 999 6668", "contactPhone2": "+962 79 999 6660", "whatsappNumber": "962799996668", "maintenanceBanner": "", "submissionsEnabled": "true"}}	86.108.45.245	2026-09-17 13:43:25.905
8eeea6af-2f57-4887-a784-cb13d7e3cdfe	5555555555	landcheck.create	landcheck	41a97124-917e-4fe6-812f-3c3f13df7fd6	{"basin": "جنوبي البلد(9)", "parcel": "22", "village": "القسطل", "serialNo": "CHK-00001", "industryType": "lightSpecial"}	86.108.45.245	2026-09-20 13:13:19.93
1970690e-78dc-4f08-b946-74d6154ce0d9	admin@alshantaf.com	auth.login	\N	\N	\N	86.108.45.245	2026-09-20 14:28:38.441
df9dc207-8368-4002-951d-d79f8980dd0d	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	86.108.45.245	2026-09-20 15:50:16.879
64470077-0d58-451c-9712-9a7c7a76e707	ahmad@alshantaf.com	auth.login	\N	\N	\N	86.108.45.245	2026-09-23 18:14:35.762
3e672bec-f9d6-459b-a3a4-4d8a7b4669c1	ahmad@alshantaf.com	landcheck.update	landcheck	73d631b4-b066-4850-98da-d483da8fcb36	{"status": "closed", "serialNo": "CHK-00003"}	86.108.45.245	2026-09-23 18:15:36.858
927e1ecf-7274-46dc-bd7c-9ec056fc6c0d	ahmad@alshantaf.com	landcheck.update	landcheck	73d631b4-b066-4850-98da-d483da8fcb36	{"status": "closed", "serialNo": "CHK-00003"}	86.108.45.245	2026-09-23 18:15:39.732
9bd23c23-0573-48cb-8cbb-f7f8b6ab0b80	ahmad@alshantaf.com	landcheck.update	landcheck	2ececa66-fbda-4699-a799-e926351615ad	{"status": "closed", "serialNo": "CHK-00002"}	86.108.45.245	2026-09-23 18:15:42.385
46ad19be-543f-4c69-a97e-8a19eb0b05e1	ahmad@alshantaf.com	landcheck.update	landcheck	41a97124-917e-4fe6-812f-3c3f13df7fd6	{"status": "closed", "serialNo": "CHK-00001"}	86.108.45.245	2026-09-23 18:15:43.227
94dbed1d-04d6-4c6b-bac3-3d6a8084571d	ahmad@alshantaf.com	landcheck.delete	landcheck	73d631b4-b066-4850-98da-d483da8fcb36	{"serialNo": "CHK-00003"}	86.108.45.245	2026-09-23 18:15:49.125
8cef17ad-c172-425d-a6de-065d7a647e00	ahmad@alshantaf.com	landcheck.delete	landcheck	2ececa66-fbda-4699-a799-e926351615ad	{"serialNo": "CHK-00002"}	86.108.45.245	2026-09-23 18:15:50.973
f4a87fbd-59af-4d55-a748-0ae16124fd1c	ahmad@alshantaf.com	landcheck.delete	landcheck	41a97124-917e-4fe6-812f-3c3f13df7fd6	{"serialNo": "CHK-00001"}	86.108.45.245	2026-09-23 18:15:53.418
57a54b28-9747-481a-b00c-86978992d717	public	landcheck.create	landcheck	8cfb791d-9af8-4245-a8bf-1e504b9147cb	{"basin": "الجنوبي(4)", "parcel": "134", "village": "ارينبه الغربيه", "serialNo": "CHK-00005", "wasDraft": true, "industryType": "residentialAgri"}	94.249.90.162	2026-09-24 08:53:50.43
85f3cb3e-8751-43b8-923e-985953d4d4dc	system	submission.tracking_email_failed	submission	c6079e25-84ac-4bc1-996f-928e748ea100	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00006"}	94.249.90.162	2026-09-24 10:52:34.496
39795fdb-9133-4322-9171-7f03e8b2aebc	system	submission.tracking_email_failed	submission	5dc535e3-40ab-4f28-8b53-8609bc72f592	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00007"}	94.249.90.162	2026-09-24 11:01:10.839
b9597b06-4e36-4d25-bb6c-aa0de3f5d0af	system	submission.tracking_email_failed	submission	89174abf-ea61-44b1-a0fd-590acb25e423	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00008"}	94.249.90.162	2026-09-24 11:06:30.746
71a86566-428b-4e5a-9a78-268b439a1d91	system	submission.tracking_email_failed	submission	7a843f1d-3b8d-4b03-abec-56d5f10329d6	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00009"}	94.249.90.162	2026-09-24 11:09:51.555
3a25955a-68ce-4536-9abf-68b107f3d433	system	submission.tracking_email_failed	submission	a7751617-5b2e-4b48-bb55-d8fa405e0d5c	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00010"}	94.249.90.162	2026-09-24 11:12:38.94
ef03beb4-e387-4a6e-95fd-e0470158283c	public	landcheck.create	landcheck	eaab9bd9-f4ee-41f5-88c0-4345d22ae448	{"basin": "شرقي الخط(1)", "parcel": "707", "village": "القسطل", "serialNo": "CHK-00004", "wasDraft": true, "industryType": "lightSpecial"}	86.108.46.184	2026-09-26 13:32:36.816
8207ee8a-311b-4cc1-8285-5942b5aeac3b	public	landcheck.create	landcheck	0919e174-268e-4665-afe7-67486d06ce38	{"basin": "ام خروبة(25)", "parcel": "71", "village": "الرمان", "serialNo": "CHK-00012", "wasDraft": true, "industryType": "residentialAgri"}	176.29.158.169	2026-09-28 10:41:53.67
cca30129-3f35-48d6-9a91-12b176cd545f	system	submission.tracking_email_failed	submission	fdcfa0e7-3659-4d19-9c87-99a9cd95e343	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00011"}	94.249.49.77	2026-09-29 11:05:08.149
1bbe2f1b-9da5-4ec7-a929-5394ce071a86	system	submission.tracking_email_failed	submission	75112d32-07f9-43d5-a55f-55ad493f5baf	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00012"}	94.249.49.77	2026-09-29 11:09:34.501
8050a55c-49dd-4a4f-b16d-4a922416834b	admin@alshantaf.com	auth.login	\N	\N	\N	172.225.160.181	2026-09-29 11:19:46.493
0e1a7787-1d88-45aa-9508-b8cb412514a8	admin@alshantaf.com	submission.update	submission	75112d32-07f9-43d5-a55f-55ad493f5baf	{"parcel": "699", "status": "needs_info", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "احمد سامي حسن الشنتف"}	172.225.160.185	2026-09-29 11:22:32.208
ee077234-4235-4484-9f22-90e24483bead	admin@alshantaf.com	submission.update	submission	75112d32-07f9-43d5-a55f-55ad493f5baf	{"parcel": "699", "status": "needs_info", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "احمد سامي حسن الشنتف"}	172.225.160.185	2026-09-29 11:23:18.599
5b1c5439-e5f2-431b-ae99-c36c68ce9b45	admin@alshantaf.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "status": "needs_info", "village": "al qastal", "reviewer": "Alshantaf Admin", "applicant": "waleed najim"}	172.225.160.185	2026-09-29 11:23:25.197
03714598-daf1-48fd-bb22-133f27d7fb46	admin@alshantaf.com	submission.approve	submission	fdcfa0e7-3659-4d19-9c87-99a9cd95e343	{"parcel": "698", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d", "listingNo": "SH-QAS-0001", "published": true, "imageCount": 3, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	172.225.160.185	2026-09-29 11:25:28.811
378aa793-b22e-48d6-86dd-e853270192d7	admin@alshantaf.com	listing.update	listing	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	\N	172.225.160.185	2026-09-29 11:27:55.088
4119a5be-e78b-47f1-b693-1f74baac05a7	admin@alshantaf.com	listing.update	listing	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	\N	172.225.160.185	2026-09-29 11:30:13.917
b133a0ff-8d52-466b-8270-cc824b43aae4	admin@alshantaf.com	listing.update	listing	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	\N	172.225.160.185	2026-09-29 11:30:40.993
8658bcc8-a977-4044-b440-e845f31118d2	admin@alshantaf.com	listing.update	listing	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	\N	172.225.160.185	2026-09-29 11:31:11.71
d17c50f7-8e7f-4aad-a9a0-d287e64a68c5	admin@alshantaf.com	listing.update	listing	d285c447-47a9-4657-83c0-65ddd021c6ea	\N	172.225.160.185	2026-09-29 11:32:25.15
10eae8f7-17b7-4810-8b7b-b24156643be4	system	submission.tracking_email_failed	submission	c82808b3-eaaa-418a-a57f-845b3c8c357c	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00013"}	94.249.49.77	2026-09-29 11:35:30.485
9f8d07e2-9b5b-47c5-a480-f5061333fcb8	system	submission.tracking_email_failed	submission	c1336666-30da-4b4c-b8e8-1c7e1b57c9cd	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00014"}	94.249.49.77	2026-09-29 12:11:48.576
7dcda067-078c-442c-a1f2-14a7c628471e	system	submission.tracking_email_failed	submission	fcf79aef-3da8-4a01-b992-39f79d590f70	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00015"}	94.249.49.77	2026-09-29 12:27:52.463
45b7db15-07dd-47ad-ad7a-46afc99299f7	system	submission.tracking_email_failed	submission	4b51af42-1eb6-4b43-b540-84578238043e	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00016"}	94.249.49.77	2026-09-29 12:33:25.597
ce539211-d4d3-491b-976a-ea69f7ac0517	system	submission.tracking_email_failed	submission	ff316e89-3248-4c35-8403-5b516bbd703a	{"email": "ahmad@alshantaf.com", "serialNo": "REQ-00017"}	94.249.49.77	2026-09-29 12:38:58.105
27d4ace2-eeca-4912-a41e-db5ee77fa18e	admin@alshantaf.com	listing.delete	listing	d285c447-47a9-4657-83c0-65ddd021c6ea	{"title": "أرض صناعية في منطقة القسطل الصناعية", "listingNo": "SH-OTH-0001"}	172.225.160.182	2026-09-29 13:28:46.103
86abb69d-40ea-462f-aa74-9a1846907578	admin@alshantaf.com	submission.approve	submission	c1336666-30da-4b4c-b8e8-1c7e1b57c9cd	{"parcel": "704", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "457f5d97-fa91-4c82-828b-bad4ee438c0f", "listingNo": "SH-QAS-0002", "published": true, "imageCount": 3, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	172.225.160.183	2026-09-29 13:43:14.194
b45a96d1-1f77-4b70-9414-e800a7e6e97c	public	landcheck.create	landcheck	e03504a4-8aaa-4e5b-b0dc-e55647126fbe	{"basin": "شرقي الخط(1)", "parcel": "22", "village": "القسطل", "serialNo": "CHK-00015", "wasDraft": true, "industryType": "light"}	176.29.30.87	2026-09-29 13:45:37.666
b6996aea-fdb5-4fcf-b3ea-569db3ff2a98	public	landcheck.create	landcheck	66d51b53-105a-4ba4-8f11-76a816d96024	{"basin": "المنشيه(5)", "parcel": "2", "village": "المشتى", "serialNo": "CHK-00006", "wasDraft": true, "industryType": "mediumSpecial"}	94.249.49.77	2026-09-30 08:45:57.632
e70646cd-a521-495b-8419-caf40c85c198	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	86.108.44.61	2026-09-30 14:57:41.953
6eea53f6-ebcf-4d64-9428-746d9b6e0092	ahmed@alwathbasteelfiber.com	admin_user.update	user	5bb64949-c216-4876-8a75-61be3aaa3771	{"email": "ahmad@alshantaf.com"}	86.108.44.61	2026-09-30 14:58:08.37
30bc87af-3f0e-4288-8b26-67f4f64eb83c	ahmed@alwathbasteelfiber.com	admin_user.create	user	823219a6-d2c3-4cba-a55a-071612c1a6f3	{"email": "mohammad@alshantaf.com"}	86.108.44.61	2026-09-30 15:06:12.339
1dfdee49-c6cf-4553-9d33-fc7217a58ca8	mohammad@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:08:29.777
13d132d2-1e17-4700-94f0-84ee8626e21c	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:10:42.113
d00d3370-b28a-44e2-89c0-61861c01ba69	ahmad@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:22:36.768
e0094180-b34c-4c30-957f-aaf15ffb0488	ahmad@alshantaf.com	admin_user.create	user	bca57644-cef6-4294-bf08-cb0f702aea91	{"email": "farah@alshantaf.com", "permissions": ["listings", "media"]}	104.23.205.142	2026-09-30 15:32:10.074
bde8d3fa-2ebb-4908-8c8c-b81915f2a51a	farah@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:32:52.893
b20adf27-35a7-490c-8d58-3f9d3fc5b6b1	farah@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:32:55.626
11cab201-9dfd-4196-88e3-a546042c5fb8	farah@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:32:58.261
dd5e547f-d5cd-47e8-b2bd-5693e836b4de	ahmad@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:33:25.773
6beff426-369f-48d9-90cb-d2cde448e07a	farah@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:34:04.111
a3d6ed0a-518c-4fd0-8633-d84a1fdbc2d5	ahmad@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-09-30 15:37:51.267
4d6be311-a125-4241-8411-5f48b7c1b4b3	ahmad@alshantaf.com	auth.login	\N	\N	\N	172.68.234.218	2026-09-30 16:06:59.385
5cd3be2c-4e74-4bd3-a240-637b0f6b3392	ahmad@alshantaf.com	submission.approve	submission	ff316e89-3248-4c35-8403-5b516bbd703a	{"parcel": "706-607-608-609", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc", "listingNo": "SH-QAS-0003", "published": true, "imageCount": 1, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": true}	162.159.122.92	2026-09-30 16:10:20.056
cd55b842-d098-4882-8f52-4fea1737a6dc	ahmad@alshantaf.com	submission.approve	submission	4b51af42-1eb6-4b43-b540-84578238043e	{"parcel": "606-607-608", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "6d9225f8-3212-4bd2-9f4e-8259b908a392", "listingNo": "SH-QAS-0004", "published": true, "imageCount": 1, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": true}	162.159.122.92	2026-09-30 16:10:50.697
e8500565-c18f-4bb1-aaf0-20c45be13d40	ahmad@alshantaf.com	submission.approve	submission	fcf79aef-3da8-4a01-b992-39f79d590f70	{"parcel": "706-708", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "2499eb33-f344-4cb4-80b3-bf991e686f39", "listingNo": "SH-QAS-0005", "published": true, "imageCount": 1, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": true}	162.159.122.92	2026-09-30 16:11:10.255
6f392c31-b0c4-4922-84de-e5d228a9461c	ahmad@alshantaf.com	submission.approve	submission	c82808b3-eaaa-418a-a57f-845b3c8c357c	{"parcel": "702", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "d38c28d8-a66c-486d-8406-986fa939c5d0", "listingNo": "SH-QAS-0006", "published": true, "imageCount": 3, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:11:38.177
fd155ad5-2537-4ca8-bfb2-c056fa418e38	ahmad@alshantaf.com	submission.approve	submission	75112d32-07f9-43d5-a55f-55ad493f5baf	{"parcel": "699", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5", "listingNo": "SH-QAS-0007", "published": true, "imageCount": 3, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:11:51.018
f6326574-4882-47bd-bd2e-af7250dbb6d7	ahmad@alshantaf.com	submission.approve	submission	a7751617-5b2e-4b48-bb55-d8fa405e0d5c	{"parcel": "707", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "f493b4bb-c381-44aa-a674-deec39cf502a", "listingNo": "SH-QAS-0008", "published": true, "imageCount": 2, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:12:01.127
b900d825-552d-4fd3-b066-f07a4d30aee0	ahmad@alshantaf.com	submission.approve	submission	7a843f1d-3b8d-4b03-abec-56d5f10329d6	{"parcel": "709", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58", "listingNo": "SH-QAS-0009", "published": true, "imageCount": 2, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:12:07.699
2fbf9865-98f2-4c3b-9bac-91b75b30c64e	ahmad@alshantaf.com	submission.approve	submission	89174abf-ea61-44b1-a0fd-590acb25e423	{"parcel": "708", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "71de6a57-f511-42ae-a67b-02c26f8c3f11", "listingNo": "SH-QAS-0010", "published": true, "imageCount": 2, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:12:13.358
444b2831-c77f-40f6-9efa-4fd2efa2a991	ahmad@alshantaf.com	submission.approve	submission	5dc535e3-40ab-4f28-8b53-8609bc72f592	{"parcel": "707", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "810e5588-7520-4047-a983-e5ddedf9c644", "listingNo": "SH-QAS-0011", "published": true, "imageCount": 3, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:12:19.512
b27edaab-bd59-4da6-9e1e-62fa1e6cf603	ahmad@alshantaf.com	submission.approve	submission	c6079e25-84ac-4bc1-996f-928e748ea100	{"parcel": "706", "village": "القسطل", "applicant": "احمد سامي حسن الشنتف", "listingId": "e87a4745-15c6-40de-aa1a-a1d5829c77a7", "listingNo": "SH-QAS-0012", "published": true, "imageCount": 3, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:12:27.223
56c6f07d-9eca-478f-81f4-2178275951a2	ahmad@alshantaf.com	submission.approve	submission	cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	{"parcel": "681", "village": "القسطل", "applicant": "hfgddmgf", "listingId": "51a6e257-283e-4f71-9cf3-d5eb5cd27bdc", "listingNo": "SH-QAS-0013", "published": true, "imageCount": 0, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:12:37.811
a644ad50-53e2-41a4-b88f-4c59929c007b	ahmad@alshantaf.com	submission.approve	submission	63d09938-cae0-4005-b508-a5dbc64d9c85	{"parcel": "681", "village": "القسطل", "applicant": "hfgddmgf", "listingId": "5f96d63a-4461-4ddb-9042-521d9b6c953f", "listingNo": "SH-QAS-0014", "published": true, "imageCount": 0, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:12:51.256
752dc48c-ed76-42b4-90e7-0c948450c402	ahmad@alshantaf.com	listing.update	listing	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	\N	162.158.23.165	2026-09-30 17:17:41.086
ab535b72-7ccc-43f4-b964-dce7c9370c33	ahmad@alshantaf.com	listing.feature	listing	810e5588-7520-4047-a983-e5ddedf9c644	\N	162.158.23.165	2026-09-30 17:17:59.643
a4a45d86-49ea-4a55-981d-9ce88bff51f9	ahmad@alshantaf.com	submission.approve	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "village": "al qastal", "applicant": "waleed najim", "listingId": "f89120eb-ba6d-423c-abd7-6b77c4447eed", "listingNo": "SH-OTH-0001", "published": true, "imageCount": 0, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.159.122.92	2026-09-30 16:16:33.725
2272d4d0-9715-4b81-a8c4-73c2420fe5a8	ahmad@alshantaf.com	submission.update	submission	1b6e6b58-81b9-4d71-98ae-ade298739b09	{"parcel": "9", "status": "rejected", "village": "تجريبي", "reviewer": "Alshantaf Admin", "applicant": "Prod Test"}	162.159.122.92	2026-09-30 16:17:06.087
72ba4851-c704-493f-bf39-d65ed20451b9	ahmad@alshantaf.com	submission.update	submission	1cf7d931-2753-44f8-b740-541eac5bd424	{"parcel": null, "status": "rejected", "village": null, "reviewer": "Alshantaf Admin", "applicant": "x"}	162.159.122.92	2026-09-30 16:17:08.181
dd9cde18-be77-4af2-93d8-7d63448eebd4	ahmad@alshantaf.com	listing.update	listing	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	\N	162.159.122.93	2026-09-30 16:18:58.747
d40a67c3-9b07-4366-b3ea-d923ee456353	ahmad@alshantaf.com	listing.update	listing	457f5d97-fa91-4c82-828b-bad4ee438c0f	\N	162.159.122.92	2026-09-30 16:20:55.286
2f16dbb4-bf4f-422b-ade7-a3440f8050ef	ahmad@alshantaf.com	listing.update	listing	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	\N	162.159.122.92	2026-09-30 16:23:27.015
e10397f0-d59d-44bd-b1bb-45358aa2079e	ahmad@alshantaf.com	listing.update	listing	457f5d97-fa91-4c82-828b-bad4ee438c0f	\N	162.159.122.92	2026-09-30 16:23:38.94
471914f1-cda6-40fd-9092-b26b8a6bd379	ahmad@alshantaf.com	listing.update	listing	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	\N	162.159.122.92	2026-09-30 16:23:58.971
e73d1a45-b46d-443e-bf3f-9d4a91482646	ahmad@alshantaf.com	listing.delete	listing	f89120eb-ba6d-423c-abd7-6b77c4447eed	{"title": "أرض صناعية في al qastal", "listingNo": "SH-OTH-0001"}	162.159.122.93	2026-09-30 16:24:28.473
e4b736ea-4522-4d12-b4df-2e3fac7d8ea9	ahmad@alshantaf.com	listing.delete	listing	5f96d63a-4461-4ddb-9042-521d9b6c953f	{"title": "أرض صناعية في القسطل", "listingNo": "SH-QAS-0014"}	162.159.122.93	2026-09-30 16:24:56.948
2b091031-fc63-4834-a116-01f72ef3c9a8	ahmad@alshantaf.com	listing.delete	listing	51a6e257-283e-4f71-9cf3-d5eb5cd27bdc	{"title": "أرض صناعية في القسطل", "listingNo": "SH-QAS-0013"}	162.159.122.92	2026-09-30 16:25:08.55
173525d4-96fb-423d-b264-99033406db47	ahmad@alshantaf.com	listing.update	listing	e87a4745-15c6-40de-aa1a-a1d5829c77a7	\N	162.159.122.93	2026-09-30 16:25:31.224
708b2516-2482-432d-8fc5-c6fd86f638ed	ahmad@alshantaf.com	listing.update	listing	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	162.159.122.93	2026-09-30 16:25:57.917
e9d9e214-0564-4035-ac11-46196d641c70	ahmad@alshantaf.com	listing.update	listing	810e5588-7520-4047-a983-e5ddedf9c644	\N	162.159.122.93	2026-09-30 16:26:19.422
87fb1f4a-51a1-4723-a58a-c0dc00b1a3d4	ahmad@alshantaf.com	listing.update	listing	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	\N	162.159.122.92	2026-09-30 16:26:45.914
cb361670-be62-4676-a810-6a010aad5f23	ahmad@alshantaf.com	listing.update	listing	f493b4bb-c381-44aa-a674-deec39cf502a	\N	162.159.122.93	2026-09-30 16:27:03.206
4d09dc93-29e9-4231-81bd-6aa9bae6deb8	ahmad@alshantaf.com	listing.update	listing	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	\N	162.159.122.93	2026-09-30 16:27:16.915
f4a8d3a7-92d2-4133-abeb-78e771c3294d	ahmad@alshantaf.com	listing.update	listing	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	\N	162.159.122.92	2026-09-30 16:28:04.673
5aeb26e8-bb67-429a-842d-5f1e9f461cf6	ahmad@alshantaf.com	listing.update	listing	457f5d97-fa91-4c82-828b-bad4ee438c0f	\N	162.159.122.92	2026-09-30 16:28:12.097
976c5eb4-16da-463f-b09b-689c0c2852c3	ahmad@alshantaf.com	listing.update	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	\N	162.159.122.92	2026-09-30 16:28:24.084
038146c6-d0f1-4c14-9186-643c83800b50	ahmad@alshantaf.com	listing.update	listing	d38c28d8-a66c-486d-8406-986fa939c5d0	\N	162.159.122.93	2026-09-30 16:29:15.242
78d06df5-af6d-41a7-80a7-fd3fcd2a4012	ahmad@alshantaf.com	listing.update	listing	6d9225f8-3212-4bd2-9f4e-8259b908a392	\N	162.159.122.93	2026-09-30 16:29:29.882
7674adf7-affe-423e-a937-adb6419e0e6b	ahmad@alshantaf.com	listing.update	listing	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	162.159.122.93	2026-09-30 16:30:30.194
a8861380-3511-4bf1-b974-389ad0c2ee90	ahmad@alshantaf.com	listing.create	listing	90580de3-7818-42df-acbf-5c492550166d	{"title": "القسطل الصناعية ", "listingNo": "SH-QAS-0013"}	172.70.108.181	2026-09-30 17:00:07.906
cf5da0b0-c55d-4699-b16b-031e57aec49e	ahmad@alshantaf.com	listing.update	listing	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	172.70.108.180	2026-09-30 17:01:54.615
73a97a9d-5238-48d5-8405-5d4756f96229	ahmad@alshantaf.com	submission.update	submission	cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	{"parcel": "681", "status": "rejected", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "hfgddmgf"}	162.159.122.93	2026-09-30 17:06:52.339
39dc21a1-fb40-4fb2-9d05-6564fb0b906e	ahmad@alshantaf.com	submission.update	submission	cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	{"parcel": "681", "status": "rejected", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "hfgddmgf"}	162.159.122.93	2026-09-30 17:06:56.652
5f1b2dec-100c-400d-a917-328d8a14630d	ahmad@alshantaf.com	submission.update	submission	cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	{"parcel": "681", "status": "needs_info", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "hfgddmgf"}	162.159.122.93	2026-09-30 17:06:59.032
85f6246f-4996-43aa-ab85-4a434bf58d8c	ahmad@alshantaf.com	submission.update	submission	63d09938-cae0-4005-b508-a5dbc64d9c85	{"parcel": "681", "status": "rejected", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "hfgddmgf"}	162.159.122.93	2026-09-30 17:07:05.231
ced5d3e7-0bba-4b05-aed6-7905e8e50016	ahmad@alshantaf.com	submission.update	submission	1cf7d931-2753-44f8-b740-541eac5bd424	{"parcel": null, "status": "rejected", "village": null, "reviewer": "Alshantaf Admin", "applicant": "x"}	162.159.122.93	2026-09-30 17:07:15.358
7e7f2793-8d7d-4476-b451-7fe96ed176d7	ahmad@alshantaf.com	submission.update	submission	1b6e6b58-81b9-4d71-98ae-ade298739b09	{"parcel": "9", "status": "rejected", "village": "تجريبي", "reviewer": "Alshantaf Admin", "applicant": "Prod Test"}	162.159.122.93	2026-09-30 17:07:18.094
5791b65d-7015-42f5-832e-96248107fff7	ahmad@alshantaf.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "status": "rejected", "village": "al qastal", "reviewer": "Alshantaf Admin", "applicant": "waleed najim"}	162.159.122.93	2026-09-30 17:07:25.671
a9a92a2a-df21-41dc-84c3-c62f23aee898	ahmad@alshantaf.com	listing.update	listing	90580de3-7818-42df-acbf-5c492550166d	\N	162.158.23.165	2026-09-30 17:09:58.25
5b4f7ece-5d39-4d00-825f-f158ec31b08d	ahmad@alshantaf.com	listing.update	listing	90580de3-7818-42df-acbf-5c492550166d	\N	162.158.23.165	2026-09-30 17:12:18.858
c0539986-b15e-4ca2-bf00-e1c862cdd5c0	ahmad@alshantaf.com	listing.update	listing	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	162.158.23.165	2026-09-30 17:13:36.79
61220916-e69f-4cb1-b422-556090f874d9	ahmad@alshantaf.com	listing.update	listing	6d9225f8-3212-4bd2-9f4e-8259b908a392	\N	162.158.23.165	2026-09-30 17:15:09.601
74e3c29e-2afd-4352-9a29-bc2d286bd729	ahmad@alshantaf.com	listing.update	listing	f493b4bb-c381-44aa-a674-deec39cf502a	\N	162.158.23.165	2026-09-30 17:16:06.204
b5b6cf67-5471-4ed3-8981-c6d506f6efca	ahmad@alshantaf.com	listing.feature	listing	e87a4745-15c6-40de-aa1a-a1d5829c77a7	\N	162.158.23.165	2026-09-30 17:18:02.043
ee6fdaac-20df-4e86-99ce-cee781c55ecf	ahmad@alshantaf.com	listing.feature	listing	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	\N	162.158.23.165	2026-09-30 17:18:06.214
aab66c33-fba5-4fb3-aecb-a0716a0e1d65	ahmad@alshantaf.com	listing.feature	listing	457f5d97-fa91-4c82-828b-bad4ee438c0f	\N	162.158.23.165	2026-09-30 17:18:09.004
05578de9-4e6d-45c1-b7ec-69150175dda4	ahmad@alshantaf.com	listing.feature	listing	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	\N	162.158.23.165	2026-09-30 17:18:11.981
6f2e77ea-4490-421e-85e4-cd3c02511af7	ahmad@alshantaf.com	listing.feature	listing	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	162.158.23.165	2026-09-30 17:18:15.191
99b41ce3-9eb0-478f-a2d5-cb0fb7752ba0	ahmad@alshantaf.com	listing.unfeature	listing	90580de3-7818-42df-acbf-5c492550166d	\N	162.158.23.165	2026-09-30 17:18:17.952
ff2e43ee-abe1-47bf-80a1-594b5ac9b326	ahmad@alshantaf.com	listing.feature	listing	90580de3-7818-42df-acbf-5c492550166d	\N	162.158.23.165	2026-09-30 17:18:25.253
3aa97725-9c7e-497e-8eb7-c981f5c214ac	ahmad@alshantaf.com	listing.feature	listing	d38c28d8-a66c-486d-8406-986fa939c5d0	\N	162.158.23.165	2026-09-30 17:18:27.982
93e4d76e-dc5a-4e5b-a161-7411dc225541	ahmad@alshantaf.com	listing.feature	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	\N	162.158.23.165	2026-09-30 17:18:31.295
e2ab45e6-890f-43bf-896b-b6ebc7e86875	ahmad@alshantaf.com	landcheck.delete	landcheck	4832e9d2-36b0-4645-be04-9b05eb0f1f34	{"serialNo": "CHK-00024"}	162.158.23.165	2026-09-30 17:20:39.52
b4628bf8-fece-488c-8f60-09a6b1e1b3ab	ahmad@alshantaf.com	submission.update	submission	cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	{"parcel": "681", "status": "rejected", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "hfgddmgf"}	162.158.14.252	2026-10-01 09:47:43.625
de793e02-8e02-427c-a26b-0974f9033f90	ahmad@alshantaf.com	submission.update	submission	cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	{"parcel": "681", "status": "rejected", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "hfgddmgf"}	162.158.14.252	2026-10-01 09:47:56.241
e83aa29f-df43-41fa-b860-b5c00545a876	ahmad@alshantaf.com	submission.update	submission	63d09938-cae0-4005-b508-a5dbc64d9c85	{"parcel": "681", "status": "rejected", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "hfgddmgf"}	162.158.14.252	2026-10-01 09:48:09.961
d9abd597-0b70-459c-9213-fb4a50b37c67	ahmad@alshantaf.com	submission.update	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "status": "rejected", "village": "al qastal", "reviewer": "Alshantaf Admin", "applicant": "waleed najim"}	162.158.14.252	2026-10-01 09:48:15.132
9d680011-6fea-4459-94b4-324bbc3bdf4a	ahmad@alshantaf.com	submission.update	submission	1b6e6b58-81b9-4d71-98ae-ade298739b09	{"parcel": "9", "status": "rejected", "village": "تجريبي", "reviewer": "Alshantaf Admin", "applicant": "Prod Test"}	162.158.14.252	2026-10-01 09:48:18.639
34ff2b3a-1b3b-495e-98a5-d4171ad886de	ahmad@alshantaf.com	submission.update	submission	1cf7d931-2753-44f8-b740-541eac5bd424	{"parcel": null, "status": "rejected", "village": null, "reviewer": "Alshantaf Admin", "applicant": "x"}	162.158.14.252	2026-10-01 09:48:22.119
c1d4e975-2e30-44dd-8686-0d8c9e4cf793	ahmad@alshantaf.com	listing.update	listing	90580de3-7818-42df-acbf-5c492550166d	\N	162.158.14.252	2026-10-01 09:49:49.952
4ff12513-2d13-4acb-8fcb-9ce2d01e62ab	ahmad@alshantaf.com	listing.update	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	\N	162.158.14.252	2026-10-01 09:50:43.196
5700f428-2c12-43a8-b56f-4d814229eeb7	ahmad@alshantaf.com	listing.update	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	\N	162.158.14.252	2026-10-01 09:52:06.219
80ab82ab-d77c-45e4-b6ce-403547e74907	ahmad@alshantaf.com	listing.update	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	\N	162.158.14.252	2026-10-01 09:52:49.131
e73787cd-2f72-47d4-bec8-e5e1c56fedb1	ahmad@alshantaf.com	listing.update	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	\N	162.158.14.252	2026-10-01 09:53:26.966
171d1adf-b40b-4cad-b4db-719d6e9e49d1	ahmad@alshantaf.com	listing.update	listing	90580de3-7818-42df-acbf-5c492550166d	\N	162.158.14.252	2026-10-01 09:54:49.509
d7c220c9-ccdc-4060-967b-e4b4eb982cc6	ahmad@alshantaf.com	listing.update	listing	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	162.158.19.41	2026-10-01 09:57:48.089
cd05ef27-4127-448d-978d-1da929f1cc73	ahmad@alshantaf.com	listing.update	listing	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	162.158.19.41	2026-10-01 09:58:06.351
fde5c686-36ec-46a2-8be3-d739269ade70	ahmad@alshantaf.com	listing.update	listing	90580de3-7818-42df-acbf-5c492550166d	\N	162.158.19.41	2026-10-01 10:12:48.87
bf925c8c-3580-4440-8ace-9bd7f361172b	ahmad@alshantaf.com	listing.update	listing	d38c28d8-a66c-486d-8406-986fa939c5d0	\N	162.158.19.41	2026-10-01 10:14:08.205
cb03a85c-a8b4-471e-af39-f49a9690b9ee	ahmad@alshantaf.com	listing.update	listing	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	\N	162.158.19.41	2026-10-01 10:14:45.755
f3b8ea10-5190-4a87-902f-c6a9c2eb81bf	ahmad@alshantaf.com	listing.update	listing	457f5d97-fa91-4c82-828b-bad4ee438c0f	\N	162.158.19.41	2026-10-01 10:15:25.15
018e0814-3df4-4b09-8f1b-a1128ef63104	ahmad@alshantaf.com	listing.update	listing	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	\N	162.158.19.41	2026-10-01 10:16:26.372
c151b087-bc88-4461-8f2a-90374332b992	ahmad@alshantaf.com	listing.unpublish	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	{"publishStatus": "draft"}	162.158.19.41	2026-10-01 10:16:26.892
e5feb776-1ada-4dbe-b6f9-17b72670759f	ahmad@alshantaf.com	listing.update	listing	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	162.158.19.41	2026-10-01 10:16:42.646
930aa6af-b36b-4913-ade4-75d35c09c8a1	ahmad@alshantaf.com	listing.update	listing	d38c28d8-a66c-486d-8406-986fa939c5d0	\N	162.158.19.41	2026-10-01 10:17:51.596
c7e8ad39-c174-4510-ad73-39c4827b94b9	ahmad@alshantaf.com	listing.update	listing	e87a4745-15c6-40de-aa1a-a1d5829c77a7	\N	162.158.19.41	2026-10-01 10:19:11.221
d05a624f-f3cb-4e0a-bd45-5bf96d22d0e5	ahmad@alshantaf.com	listing.update	listing	e87a4745-15c6-40de-aa1a-a1d5829c77a7	\N	162.158.14.252	2026-10-01 10:20:39.027
10db347a-882d-42c7-a582-037b4e42d68a	ahmad@alshantaf.com	listing.update	listing	810e5588-7520-4047-a983-e5ddedf9c644	\N	162.158.14.252	2026-10-01 10:20:59.004
f1d1b741-78ed-4d09-b376-146a66adbd42	ahmad@alshantaf.com	listing.update	listing	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	\N	162.158.14.252	2026-10-01 10:22:27.868
b82e4aa4-3842-4a07-b141-7d4322c55280	ahmad@alshantaf.com	listing.update	listing	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	\N	162.158.14.252	2026-10-01 10:22:48.407
0b350038-fc19-476a-9082-ced1fbae4dd3	ahmad@alshantaf.com	submission.approve	submission	cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	{"parcel": "681", "village": "القسطل", "applicant": "hfgddmgf", "listingId": "16a57904-66e1-4f16-a159-2745c006f322", "listingNo": "SH-QAS-0014", "published": true, "imageCount": 0, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.158.14.252	2026-10-01 10:25:47.726
8052c555-9bb2-4fe2-895f-770aaced6cda	ahmad@alshantaf.com	submission.approve	submission	63d09938-cae0-4005-b508-a5dbc64d9c85	{"parcel": "681", "village": "القسطل", "applicant": "hfgddmgf", "listingId": "8641381e-3b0a-423d-a6c3-0cd67324c04b", "listingNo": "SH-QAS-0015", "published": true, "imageCount": 0, "includePrice": true, "includeVideo": true, "includeParcel": false, "includeDocument": false}	162.158.14.252	2026-10-01 10:25:54.879
685eda2c-52a4-4f56-a9b3-67e922144b4d	ahmad@alshantaf.com	submission.approve	submission	b19517fe-eb25-4264-85b0-50a90993a499	{"parcel": "699", "village": "al qastal", "applicant": "waleed najim", "listingId": "7dbcfffc-f2ab-4023-807a-aac7fdf11278", "listingNo": "SH-OTH-0001", "published": true, "imageCount": 0, "includePrice": true, "includeVideo": true, "includeParcel": true, "includeDocument": false}	162.158.14.252	2026-10-01 10:28:55.393
c80a7105-8435-47fb-83b7-ea534a6d4097	ahmad@alshantaf.com	submission.update	submission	1cf7d931-2753-44f8-b740-541eac5bd424	{"parcel": null, "status": "rejected", "village": null, "reviewer": "Alshantaf Admin", "applicant": "x"}	162.158.14.252	2026-10-01 10:29:12.297
b188f896-98ee-4f67-baa8-c54d5eb070fd	ahmad@alshantaf.com	submission.update	submission	1cf7d931-2753-44f8-b740-541eac5bd424	{"parcel": null, "status": "rejected", "village": null, "reviewer": "Alshantaf Admin", "applicant": "x"}	162.158.14.252	2026-10-01 10:29:15.593
62af7392-5994-4f0a-ae07-a1e9a2d220fa	ahmad@alshantaf.com	submission.update	submission	1b6e6b58-81b9-4d71-98ae-ade298739b09	{"parcel": "9", "status": "rejected", "village": "تجريبي", "reviewer": "Alshantaf Admin", "applicant": "Prod Test"}	162.158.14.252	2026-10-01 10:29:20.891
50ae8896-e8c5-40b9-b54d-2e582ee4b689	admin@alshantaf.com	auth.login	\N	\N	\N	104.23.205.142	2026-10-02 13:42:37.753
deb30242-a5db-44e5-8037-27169464c248	ahmed@alwathbasteelfiber.com	submission.update	submission	cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	{"parcel": "681", "status": "rejected", "village": "القسطل", "reviewer": "Alshantaf Admin", "applicant": "hfgddmgf"}	104.23.205.142	2026-10-03 09:43:12.778
696ec8c4-39f5-48fb-aed8-ac4376c675ba	ahmed@alwathbasteelfiber.com	listing.delete	listing	8641381e-3b0a-423d-a6c3-0cd67324c04b	{"title": "أرض صناعية في القسطل", "listingNo": "SH-QAS-0015"}	104.23.205.142	2026-10-03 09:43:55.317
d9740f63-64d7-4486-8cfa-b5d88bf67edb	ahmed@alwathbasteelfiber.com	listing.update	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	\N	104.23.205.142	2026-10-03 09:46:34.891
6f08d3d3-14cf-49c2-84f2-9d79a428733d	ahmed@alwathbasteelfiber.com	listing.update	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	\N	104.23.205.142	2026-10-03 09:47:10.676
b50aa37a-e752-466e-9158-e27886a0887d	ahmed@alwathbasteelfiber.com	listing.publish	listing	2499eb33-f344-4cb4-80b3-bf991e686f39	{"publishStatus": "published"}	104.23.205.142	2026-10-03 09:47:13.083
ad4231f9-a9ed-49fc-8e8d-3d9622b01674	ahmed@alwathbasteelfiber.com	landcheck.update	landcheck	eaab9bd9-f4ee-41f5-88c0-4345d22ae448	{"status": "closed", "serialNo": "CHK-00004"}	104.23.205.142	2026-10-03 09:48:08.17
dbdc085f-fda2-4a71-b65c-e1b73041441b	ahmed@alwathbasteelfiber.com	listing.create	listing	670b7555-096b-46f8-9374-46a6774815bd	{"title": "قطعه أرض صناعية على شارع الشحن الجوي", "listingNo": "SH-OTH-0002"}	104.23.205.142	2026-10-03 12:27:15.287
4f8ef895-b5f9-4523-bb49-b66e0326b1bd	ahmed@alwathbasteelfiber.com	listing.update	listing	670b7555-096b-46f8-9374-46a6774815bd	\N	104.23.205.142	2026-10-03 12:27:54.158
3e0c4441-4c52-4781-b870-b86b2347ff12	ahmed@alwathbasteelfiber.com	listing.update	listing	670b7555-096b-46f8-9374-46a6774815bd	\N	104.23.205.142	2026-10-03 12:34:46.226
98720624-e59f-472a-9d65-b9fe91456f2e	ahmed@alwathbasteelfiber.com	auth.login	\N	\N	\N	172.69.173.144	2026-10-03 12:54:29.022
b9b0ff61-a7d3-4996-8b91-ff6efd79e4c6	ahmad@alshantaf.com	listing.update	listing	16a57904-66e1-4f16-a159-2745c006f322	\N	172.70.248.57	2026-10-04 21:18:02.534
0e03dfec-4ca4-4dad-8a5a-eb74349a3a08	ahmad@alshantaf.com	listing.update	listing	16a57904-66e1-4f16-a159-2745c006f322	\N	162.158.116.54	2026-10-04 21:42:15.412
1ff53627-0213-4731-b8e2-56f1ff51526c	ahmad@alshantaf.com	listing.update	listing	16a57904-66e1-4f16-a159-2745c006f322	\N	162.158.116.54	2026-10-04 21:43:02.511
1af3a772-3e60-4a14-abf6-8ec145aa7a1e	ahmad@alshantaf.com	listing.update	listing	16a57904-66e1-4f16-a159-2745c006f322	\N	162.158.116.54	2026-10-04 21:44:30.862
65826041-c27d-4ba8-8b99-80f977db0800	admin@alshantaf.com	listing.update	listing	16a57904-66e1-4f16-a159-2745c006f322	\N	104.23.205.142	2026-10-05 11:04:29.535
6dcb147f-0abf-4ebc-b51e-fd6f49175cce	public	landcheck.create	landcheck	f9c7cb3a-5141-4d65-a9d8-8ba2120151ba	{"basin": "شرقي الخط(1)", "parcel": "702", "village": "القسطل", "serialNo": "CHK-00021", "wasDraft": true, "industryType": "light"}	162.158.19.41	2026-10-05 12:16:36.833
a69de3c8-e4f4-452a-bdf7-c8a1c3f60207	admin@alshantaf.com	listing.update	listing	7dbcfffc-f2ab-4023-807a-aac7fdf11278	\N	104.23.205.142	2026-10-05 12:50:10.469
6a02bdc9-cc02-4e59-8b9d-800e946de022	admin@alshantaf.com	listing.update	listing	7dbcfffc-f2ab-4023-807a-aac7fdf11278	\N	104.23.205.142	2026-10-05 12:50:48.386
\.


--
-- Data for Name: ContactRequest; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."ContactRequest" (id, "serialNo", name, phone, "requestType", "industryType", "activityType", details, status, "adminNotes", reviewer, "reviewedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: LandCheck; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."LandCheck" (id, "serialNo", name, phone, email, governorate, directorate, village, basin, neighborhood, parcel, coordinates, latitude, longitude, address, "dlsKey", "areaSqm", "areaLabel", "administrativeValue", "administrativeValueSource", "administrativeValueAt", "estimatedMedian", "industryType", notes, status, "adminNotes", reviewer, "reviewedAt", "createdAt", "clientKey", "isDraft", "perimeterM", "updatedAt") FROM stdin;
5e977e33-c9d1-4ca4-85ec-3fbc7ef3cbb4	CHK-00011	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	705	31.743495, 35.964192	31.743495	35.964192	\N	002200100000705	2000.22122693	2,000.22 م² · 2 دونم	40	DLS Smart Land Plan	2026-09-26 14:41:40.268	80009	light	\N	new	\N	\N	\N	2026-09-26 11:28:34.837	60a648db-6394-4279-988c-fd5a4a7105c4	t	183.999959192839	2026-09-26 14:41:55.948
36016372-6b5c-45e9-b2fd-14160be3d483	CHK-00008	\N	\N	\N	محافظة العاصمة	اراضي شمال عمان	بدران	مرج الاجرب(8)	جدول الأحياء	962	32.052489, 35.927860	32.052489	35.92786	\N	011800800000962	521.08230072	521.08 م² · 0.521 دونم	125	DLS Smart Land Plan	2026-10-03 15:01:48.326	65135	residentialC	\N	new	\N	\N	\N	2026-09-24 12:21:36.867	21cf4922-f847-402b-8d1d-6d5c050d3ed1	t	92.4468970113429	2026-10-03 15:01:50.323
95131e86-0080-4cbb-a2c4-7aa07f2fa031	CHK-00010	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	ام العظام(4)	جدول الأحياء	391	31.762441, 35.939975	31.762441	35.939975	\N	002200400000391	5065.78715891	5,065.79 م² · 5.066 دونم	135	DLS Smart Land Plan	2026-09-26 09:42:47.269	683881	\N	\N	new	\N	\N	\N	2026-09-26 09:41:32.49	75445377-6fbc-477f-bafb-13ec2ee840d7	t	289.094142019067	2026-09-26 09:42:49.295
a54d3aeb-f62b-4461-bd1a-a7d7947c0591	CHK-00032	\N	\N	\N	\N	\N	\N	\N	\N	\N	31.812229, 36.137695	31.812229	36.137695	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	2026-10-03 15:01:55.757	3719c9c9-126d-4c9d-bf58-813b457a3f74	t	\N	2026-10-03 15:02:09.637
e141c85d-6f92-4629-8903-daa00d5f5107	CHK-00016	\N	\N	\N	\N	\N	\N	\N	\N	\N	32.011509, 35.738382	32.011509	35.738382	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	2026-09-27 11:20:29.125	1e94bd22-57a8-47de-9ecf-e85546b7c288	t	\N	2026-10-01 05:37:07.144
d9789607-6eb2-43a6-a58b-16770e157ec2	CHK-00017	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	706	31.743465, 35.964552	31.743465	35.964552	\N	002200100000706	2000.22522706	2,000.23 م² · 2 دونم	40	DLS Smart Land Plan	2026-09-28 15:55:38.344	80009	\N	\N	new	\N	\N	\N	2026-09-28 15:54:28.683	f41722e4-3e76-4ad8-b7fd-4f4f7a064e9a	t	184.000158385683	2026-09-28 15:55:40.226
5e1cb704-6e9e-42a5-836c-3ee5fe63b00d	CHK-00013	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	الصلاحيه	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	2026-09-26 13:32:45.386	175e6888-884a-455d-a795-517793dcfc9e	t	\N	2026-10-04 11:13:34.884
72854891-e3d9-4eb7-a8fa-b3003775ae59	CHK-00018	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	المشتى	المنشيه(5)	جدول الأحياء	580	31.757991, 35.988603	31.757991	35.988603	\N	003000500000580	2688.909743075	2,688.91 م² · 2.689 دونم	40	DLS Smart Land Plan	2026-09-28 16:31:53.393	107556	mediumSpecial	\N	new	\N	\N	\N	2026-09-28 16:29:38.187	0b1e0801-2822-450c-a842-e1ca01d5a919	t	214.167823896106	2026-09-28 16:31:55.324
6a9734c6-2ccf-437e-a4b3-37e73fe5c4da	CHK-00026	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	706	31.743465, 35.964552	31.743465	35.964552	\N	002200100000706	2000.22522706	2,000.23 م² · 2 دونم	40	DLS Smart Land Plan	2026-10-01 08:52:58.488	80009	light	\N	new	\N	\N	\N	2026-10-01 08:15:51.646	03ef7296-56cf-43d4-aba6-d638bdf70e06	t	184.000158385683	2026-10-01 08:53:00.324
e8a9fe43-ebbf-4728-9afb-fac3f7f570cb	CHK-00033	\N	\N	\N	محافظة العاصمة	اراضي غرب عمان	وادي السير	خربة الصويفية(15)	جدول الأحياء	723	31.955256, 35.856819	31.955256	35.856819	\N	006201500000723	384.554	384.55 م² · 0.385 دونم	1200	DLS Smart Land Plan	2026-10-04 11:18:02.895	461465	greenWithinD	\N	new	\N	\N	\N	2026-10-04 11:16:29.17	b18828de-f881-46b1-9a90-394e9b12a786	t	86.1435070967069	2026-10-04 11:18:04.825
870be3ca-4722-43d9-a342-48e5ab8e17c6	CHK-00020	\N	\N	\N	محافظة العاصمة	اراضي الموقر	ذهيبه الغربية	خربة الذهيبه الجنوبية(2)	جدول الأحياء	740	31.779132, 36.005185	31.779132	36.005185	\N	014600200000740	1310.51958982	1,310.52 م² · 1.311 دونم	12	DLS Smart Land Plan	2026-09-29 23:38:20.378	15726	residentialA	\N	new	\N	\N	\N	2026-09-29 13:53:18.311	6107bbc3-0c54-4e4f-9067-9e4ac29d53fc	t	142.349462916202	2026-09-29 23:38:22.442
2949da58-dae1-46f7-915f-209018ed1014	CHK-00009	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	275	31.755232, 35.964676	31.755232	35.964676	\N	002200100000275	9010.42491388	9,010.42 م² · 9.01 دونم	40	DLS Smart Land Plan	2026-10-04 14:33:44.214	360417	mediumSpecial	\N	new	\N	\N	\N	2026-09-24 12:24:46.826	88e9d86e-963e-44c6-a5f2-766a03bb1fa4	t	372.190828337282	2026-10-04 14:33:46.228
0ac3241f-7de8-4f50-9099-a255bbdbdaa4	CHK-00007	\N	\N	\N	محافظة العاصمة	اراضي عمان	عمان	عبدون الشمالي الشرقي(25)	جدول الأحياء	1213	31.943105, 35.898075	31.943105	35.898075	\N	000102500001213	25834.010134985	25,834.01 م² · 25.834 دونم	450	DLS Smart Land Plan	2026-09-24 10:27:11.157	11625305	\N	\N	new	\N	\N	\N	2026-09-24 10:21:52.091	ba21c186-fa17-469a-a912-37ae917d3d6a	t	635.8779182131251	2026-09-24 10:27:13.38
8cfb791d-9af8-4245-a8bf-1e504b9147cb	CHK-00005	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	ارينبه الغربيه	الجنوبي(4)	جدول الأحياء	134	31.618542, 35.950228	31.618542	35.950228	\N	000400400000134	11555.84037067	11,555.84 م² · 11.556 دونم	3	DLS Smart Land Plan	2026-09-24 08:52:43.188	34668	residentialAgri	\N	new	\N	\N	\N	2026-09-23 21:19:34.849	e9db89bc-0bfc-448d-b807-474a1d1770ba	f	563.8108891699429	2026-09-24 08:53:50.428
7d0f22bb-fc5a-48d5-8182-ba9c3a4a17cc	CHK-00019	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	ظهر حجرة الفرس(8)	جدول الأحياء	651	31.726993, 35.958848	31.726993	35.958848	\N	002200800000651	989.95093044	989.95 م² · 0.99 دونم	50	DLS Smart Land Plan	2026-09-29 10:44:30.936	49498	residentialC	\N	new	\N	\N	\N	2026-09-28 16:35:36.237	9624d65a-8d16-4a0f-a3e5-a0bfb9105c1a	t	126.08158789576	2026-09-29 10:44:32.829
66d51b53-105a-4ba4-8f11-76a816d96024	CHK-00006	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	المشتى	المنشيه(5)	جدول الأحياء	2	31.747374, 35.989913	31.747374	35.989913	\N	\N	\N	25,008.61 م² · 25.009 دونم	\N	\N	\N	\N	mediumSpecial	\N	new	\N	\N	\N	2026-09-24 07:28:01.471	ceed31d7-a4ba-44c7-a1c6-aa34abc6b917	f	\N	2026-09-30 08:45:57.625
e03504a4-8aaa-4e5b-b0dc-e55647126fbe	CHK-00015	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	22	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	light	\N	new	\N	\N	\N	2026-09-26 14:16:25.473	fd66ddbf-a060-4db0-93d7-f27e0ceaeab3	f	\N	2026-09-29 13:45:37.664
cce14098-f6dd-4aa7-b902-c75d9151b25b	CHK-00014	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	702	31.743820, 35.962798	31.74382	35.962798	\N	002200100000702	3318.91696752	3,318.92 م² · 3.319 دونم	40	DLS Smart Land Plan	2026-09-26 13:55:15.827	132757	light	\N	new	\N	\N	\N	2026-09-26 13:54:56.668	de6e89bc-20d7-479c-a2db-30aa06bfc8fa	t	227.730368831746	2026-09-26 13:55:17.704
0919e174-268e-4665-afe7-67486d06ce38	CHK-00012	\N	\N	\N	محافظة العاصمة	اراضي شمال عمان	الرمان	ام خروبة(25)	جدول الأحياء	71	32.133636, 35.826216	32.133636	35.826216	\N	011402500000071	9790.61583498	9,790.62 م² · 9.791 دونم	12	DLS Smart Land Plan	2026-09-28 10:38:07.573	117487	residentialAgri	\N	new	\N	\N	\N	2026-09-26 13:20:58.957	2e08dfef-9d04-4b75-b58c-1c349d79aa64	f	584.709919930838	2026-09-28 10:41:53.664
3c95ce08-100a-4019-b546-0f821c554831	CHK-00031	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	light	\N	new	\N	\N	\N	2026-10-03 09:17:04.949	7128bd85-0461-4a47-a29b-7d5edccccec6	t	\N	2026-10-03 09:17:22.886
610ca3d3-df79-40f9-b345-4d7c07019b7f	CHK-00022	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	الجيزه	الموارس(3)	جدول الأحياء	4258	31.667289, 35.941078	31.667289	35.941078	\N	017000300004258	100215.39706271	100,215.4 م² · 100.215 دونم	9	DLS Smart Land Plan	2026-09-29 14:14:17.43	901939	mediumSpecial	\N	new	\N	\N	\N	2026-09-29 14:13:17.207	818dbd3c-ea42-4a81-96e3-9a5c87bd1d1b	t	1929.71710180011	2026-09-29 14:14:19.555
f60fd0b2-8b94-4044-96d4-8ad15c846eae	CHK-00034	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	agriToIndustrial	\N	new	\N	\N	\N	2026-10-04 22:02:18.067	2ca082b0-ae32-40d2-86ad-119ee19edf46	t	\N	2026-10-04 22:02:18.067
eaab9bd9-f4ee-41f5-88c0-4345d22ae448	CHK-00004	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	707	\N	\N	\N	\N	\N	5000	5000 m²	\N	\N	\N	\N	lightSpecial	\N	closed	\N	ahmed@alwathbasteelfiber.com	2026-10-03 09:48:08.165	2026-09-23 17:17:33.946	e8ac1305-2e8e-4422-bd32-2376c3dbe9a2	f	\N	2026-10-03 09:48:08.166
34733b5d-7d56-4c5b-9557-b45de9f1e64a	CHK-00027	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	707	31.743436, 35.964911	31.743436	35.964911	\N	002200100000707	2000.218293015	2,000.22 م² · 2 دونم	40	DLS Smart Land Plan	2026-10-01 09:02:09.238	80009	light	\N	new	\N	\N	\N	2026-10-01 09:01:47.324	e6e921d4-ca81-436b-9e34-b8bf331e246d	t	183.999850620817	2026-10-01 09:02:11.074
b381255b-e18d-4ba9-8e3a-b2f2e074ba04	CHK-00035	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	المشتى	المنشيه(5)	جدول الأحياء	203	31.751485, 35.982460	31.751485	35.98246	\N	003000500000203	21825.935673605	21,825.94 م² · 21.826 دونم	40	DLS Smart Land Plan	2026-10-05 12:22:16.181	873037	mediumSpecial	\N	new	\N	\N	\N	2026-10-05 12:20:23.077	4125940e-ad55-469d-b668-bfc0b147c40c	t	609.890414212829	2026-10-05 12:22:18.16
f9c7cb3a-5141-4d65-a9d8-8ba2120151ba	CHK-00021	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	702	31.743820, 35.962798	31.74382	35.962798	\N	002200100000702	3318.91696752	3,318.92 م² · 3.319 دونم	40	DLS Smart Land Plan	2026-10-05 12:14:30.661	132757	light	هل يناسب مستودع ادويه	new	\N	\N	\N	2026-09-29 14:06:19.07	ecfba1fd-7d91-4c54-aab7-e589b91ef0a7	f	227.730368831746	2026-10-05 12:16:36.83
8fe1e005-9c3d-4245-8909-09dfd43255ca	CHK-00029	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	702	31.743820, 35.962798	31.74382	35.962798	\N	002200100000702	3318.91696752	3,318.92 م² · 3.319 دونم	40	DLS Smart Land Plan	2026-10-02 18:33:44.702	132757	mediumSpecial	\N	new	\N	\N	\N	2026-10-02 18:32:59.855	2227016b-2e69-4dcc-9b18-d6ed28b3a844	t	227.730368831746	2026-10-02 18:33:46.734
ce371aa1-cb45-478d-ac63-aedb15c69da8	CHK-00023	\N	\N	\N	محافظة العاصمة	اراضي شمال عمان	دابوق	الذهبية(4)	جدول الأحياء	251	31.743820, 35.962798	31.74382	35.962798	\N	\N	\N	3,318.92 م² · 3.319 دونم	900	DLS Smart Land Plan	2026-10-05 12:57:29.474	\N	commercialShowrooms	\N	new	\N	\N	\N	2026-09-29 15:38:50.615	a7add26e-7472-4129-8b9e-3ace2042bfef	t	\N	2026-10-05 12:57:31.323
eed37ac1-52d0-47cc-8b5b-fd27a50813f7	CHK-00030	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	الطنيب	العيادات(4)	جدول الأحياء	01803	31.798045, 35.935806	31.798045	35.935806	\N	001900400001803	975.277465165	975.28 م² · 0.975 دونم	\N	\N	\N	\N	residentialC	\N	new	\N	\N	\N	2026-10-03 09:15:11.364	1837f179-68f7-450b-b7ab-cc1844c27783	t	125.204530997964	2026-10-03 11:50:10.397
c947e429-00a3-4337-91e3-f483a057c6ce	CHK-00025	\N	\N	\N	محافظة العاصمة	اراضي عمان	عمان	جرينين الجنوبي(6)	جدول الأحياء	3294	31.962626, 35.948846	31.962626	35.948846	\N	000100600003294	1231269.29039764	1,231,269.29 م² · 1,231.269 دونم	\N	\N	\N	\N	industrialHeavy	\N	new	\N	\N	\N	2026-09-30 13:43:02.87	685c2d91-c2dc-4aa0-933f-25ed3daf15e0	t	6063.4636944295	2026-10-05 11:30:14.308
5a81afc9-0d58-4d1b-9295-f973702a0c5c	CHK-00028	\N	\N	\N	محافظة العاصمة	اراضي جنوب عمان	القسطل	شرقي الخط(1)	جدول الأحياء	706	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	2026-10-02 13:31:12.744	86a23d13-3dc6-43d1-93f7-66cc45dd2561	t	\N	2026-10-05 13:19:36.109
\.


--
-- Data for Name: Listing; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."Listing" (id, "listingNo", title, area, "propertyType", "industryType", "dealType", size, price, basin, parcel, "locationUrl", phone, status, "publishStatus", featured, "presenterRole", "presenterName", "showPresenter", description, "internalNotes", "mainImage", source, "createdAt", "updatedAt", "viewCount", governorate, village, neighborhood, directorate, "administrativeValue", "administrativeValueSource", "administrativeValueAt", latitude, longitude, address, "ownerAccessCode", "smsOptIn", "notifiedMilestones", "showEstimatedValue") FROM stdin;
2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	SH-QAS-0001	أرض صناعية في القسطل	القسطل	أرض صناعية	light	sale	1,999.96 م² · 2 دونم	60	شرقي الخط(1)	698	31.744194, 35.964177	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	t	منطقة صناعات غذائية ودوائية\r\n\r\n	تم إنشاء العرض من طلب المراجعة fdcfa0e7-3659-4d19-9c87-99a9cd95e343	/uploads/a91e9429-ff1f-4055-8cd9-1f4a80f7c997-lg.webp	review	2026-09-29 11:25:28.784	2026-09-30 16:23:27.008	5	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-09-30 16:22:55.933	31.744194	35.964177		3MF76MFFSW	t	{}	f
2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	SH-QAS-0007	أرض صناعية في القسطل مساحة ٢ دونم صناعات خفيفة 	القسطل	أرض صناعية	light	sale	1,999.96 م² · 2 دونم	60	شرقي الخط(1)	699	31.744278, 35.963845	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	f	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة 75112d32-07f9-43d5-a55f-55ad493f5baf	/uploads/11c2337f-e928-433b-b034-674443379df3-lg.webp	review	2026-09-30 16:11:51.01	2026-10-05 12:24:09.206	2	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-01 10:14:23.664	31.744278	35.963845		TKEMKSF6UR	t	{}	f
d38c28d8-a66c-486d-8406-986fa939c5d0	SH-QAS-0006	أرض صناعية في القسطل شارعين احدهما شارع السكة ٦٠ متر مميزه جدا	القسطل	أرض صناعية خفيف 	light	sale	3,318.92 م² · 3.319 دونم	\N	شرقي الخط(1)	702	31.743820, 35.962798	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	f	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة c82808b3-eaaa-418a-a57f-845b3c8c357c	/uploads/ad9ae5a6-eae5-4b7b-b149-fe27d26752ed-lg.webp	review	2026-09-30 16:11:38.168	2026-10-02 13:10:18.776	1	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-01 10:16:59.594	31.74382	35.962798		W57G55AZA9	t	{}	t
fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	SH-QAS-0009	أرض صناعية في القسطل مساحة ٦ دونمات خفيه نسبه البناء ٥٠٪؜	القسطل	أرض صناعية	light	sale	2,000.22 م² · 2 دونم	60	شرقي الخط(1)	709	31.743371, 35.965692	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	t	منطقة صناعات غذائية ودوائية بجانب مصنع الريم للمنظفات 	تم إنشاء العرض من طلب المراجعة 7a843f1d-3b8d-4b03-abec-56d5f10329d6	/uploads/5b4a9d32-8727-4d67-9737-202b95fb8b61-lg.webp	review	2026-09-30 16:12:07.691	2026-10-01 17:59:43.189	1	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-01 10:21:17.617	31.743371	35.965692		YNGFP65RC7	t	{}	f
810e5588-7520-4047-a983-e5ddedf9c644	SH-QAS-0011	أرض صناعية في القسطل	القسطل	أرض صناعية	light	sale	2,000.22 م² · 2 دونم	60	شرقي الخط(1)	707	31.743436, 35.964911	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	f	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة 5dc535e3-40ab-4f28-8b53-8609bc72f592	/uploads/4b679ba7-da73-4479-89a2-2936b79b1592-lg.webp	review	2026-09-30 16:12:19.503	2026-10-01 10:20:58.993	0	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-09-30 16:26:12.667	31.743436	35.964911		7XRXBYF399	t	{}	f
6d9225f8-3212-4bd2-9f4e-8259b908a392	SH-QAS-0004	أرض صناعية في القسطل بجانب مستودعات د. اشرف الحناوي 	القسطل	أرض صناعية	light	sale	6,000.4 م² · 6 دونم	60	شرقي الخط(1)	606, 607, 608		0799996668	available	published	t	owner	احمد سامي حسن الشنتف	t	منطقة صناعات غذائية ودوائية مميزة 	تم إنشاء العرض من طلب المراجعة 4b51af42-1eb6-4b43-b540-84578238043e	/uploads/1bad1b65-c75b-4135-ad9f-0b2dd03960d6-lg.webp	review	2026-09-30 16:10:50.686	2026-10-03 08:47:42.856	3	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	\N	\N	\N	\N	\N		VW5Z5MPK7M	t	{}	f
f493b4bb-c381-44aa-a674-deec39cf502a	SH-QAS-0008	أرض صناعية في القسطل	القسطل	أرض صناعية	light	sale	2,000.22 م² · 2 دونم	60	شرقي الخط(1)	707	31.743436, 35.964911	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	t	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة a7751617-5b2e-4b48-bb55-d8fa405e0d5c	/uploads/a61fedd5-6fb8-458e-b1b2-608f8f1aa72a-lg.webp	review	2026-09-30 16:12:01.104	2026-10-02 13:30:44.267	1	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-09-30 17:15:34.902	31.743436	35.964911		VU8U8C8284	t	{}	f
457f5d97-fa91-4c82-828b-bad4ee438c0f	SH-QAS-0002	أرض صناعية في القسطل شارع ١٢ متر معبد صناعات خفيفة 	القسطل	أرض صناعية	light	sale	2,000.23 م² · 2 دونم	60	شرقي الخط(1)	704	31.743525, 35.963833	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	t	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة c1336666-30da-4b4c-b8e8-1c7e1b57c9cd	/uploads/a7eb3c41-37de-4b85-b6ff-35e3a03ab574-lg.webp	review	2026-09-29 13:43:14.179	2026-10-05 10:11:50.743	3	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-01 10:14:59.641	31.743525	35.963833		KBHVA4FJHH	t	{}	f
2499eb33-f344-4cb4-80b3-bf991e686f39	SH-QAS-0005	أرض صناعية في القسطل	القسطل	أرض صناعية	light	sale	6,000.67 م² · 6.001 دونم	60	شرقي الخط(1)	706, 707,708	31.743423, 35.964920	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	t	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة fcf79aef-3da8-4a01-b992-39f79d590f70	/uploads/a2bfad53-2a61-4a9a-9b56-85910fa16caf-lg.webp	review	2026-09-30 16:11:10.246	2026-10-05 08:52:18.716	6	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-03 09:46:46.28	31.743423	35.96492		5AVGKXCM2G	t	{}	f
71de6a57-f511-42ae-a67b-02c26f8c3f11	SH-QAS-0010	أرض صناعية في القسطل	القسطل	أرض صناعية	light	sale	2,000.22 م² · 2 دونم	\N	شرقي الخط(1)	708	31.743369, 35.965299	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	t	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة 89174abf-ea61-44b1-a0fd-590acb25e423	/uploads/bd713995-b57b-4c40-999f-dd53f858ee67-lg.webp	review	2026-09-30 16:12:13.35	2026-10-02 13:10:18.804	1	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-01 10:16:38.749	31.743369	35.965299		UYEVT4Q47S	t	{}	f
16a57904-66e1-4f16-a159-2745c006f322	SH-QAS-0014	أرض صناعية في القسطل	القسطل	أرض صناعية	mediumSpecial	sale	1,694.45 م² · 1.694 دونم	55	شرقي الخط(1)	681	31.764115, 35.977799	0799996668	available	published	t	owner	م. احمد الشنتف	t	قطعه صغيره جدا صناعات متوسطة بسعر ٥٥ دينار للمتر	تم إنشاء العرض من طلب المراجعة cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	/uploads/e725d02d-2f57-497b-a9d6-a0babf6cc20a-lg.webp	review	2026-10-01 10:25:47.711	2026-10-05 11:51:52.369	4	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-04 21:43:20.821	31.764115	35.977799		MESZZ2H6UQ	t	{}	f
e87a4745-15c6-40de-aa1a-a1d5829c77a7	SH-QAS-0012	أرض صناعية في القسطل مساحة  ٢ دونم صناعات خفيفة تصلح لمستودعات او خط انتاج غذائي او دوائي 	القسطل	أرض صناعية	light	sale	2,000.23 م² · 2 دونم	60	شرقي الخط(1)	706	31.743465, 35.964552	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	f	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة c6079e25-84ac-4bc1-996f-928e748ea100	/uploads/1aeadc60-e89c-420e-b915-ac68328872ac-lg.webp	review	2026-09-30 16:12:27.205	2026-10-03 08:25:25.938	1	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-01 10:18:11.943	31.743465	35.964552		EHB9FBDP8U	t	{}	f
90580de3-7818-42df-acbf-5c492550166d	SH-QAS-0013	القسطل الصناعية ١٠ دونم صناعات خفيفه بإحكام خاصة بنسبة بناء ٦٠٪؜	القسطل	أرض صناعية	lightSpecial	sale	10,026.28 م² · 10.026 دونم	\N	الماكنه(2)	96	31.761943, 35.958671	0799996668	available	published	t	owner		t	ارض صناعات خفيفه تصلح للتصنيفات الغذائية والدوائية \nمع نسبة بناء عالية ٦٠٪؜		/uploads/57605ae4-f18c-4267-8683-326ee195a83c-lg.webp	admin	2026-09-30 17:00:07.886	2026-10-02 13:29:18.516	2	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-01 10:12:06.736	31.761943	35.958671		64GZVHC3UE	t	{}	f
7dbcfffc-f2ab-4023-807a-aac7fdf11278	SH-OTH-0001	أرض صناعية في  القسطل الصناعيه	القسطل	أرض صناعية	medium	sale	2,000 م² · 2 دونم		1 east	699	34.282800, 34.282828	0799966672	available	published	f	owner	waleed najim	f	قطعه صناعات خفيفة للبيع	تم إنشاء العرض من طلب المراجعة b19517fe-eb25-4264-85b0-50a90993a499	\N	review	2026-10-01 10:28:55.382	2026-10-05 12:50:48.374	0	amman	al qastal	jad		\N	\N	\N	34.2828	34.282828		3YJQ73477Y	t	{}	f
670b7555-096b-46f8-9374-46a6774815bd	SH-OTH-0002	قطعه أرض صناعية على شارع الشحن الجوي	المشتى	أرض صناعية	mediumSpecial	sale	25,008.61 م² · 25.009 دونم	55	المنشيه(5)	68	31.747374, 35.989913	0799996668	available	published	t	presenter	خالد نجم	f	\nقطعه أرض صناعية مميزة على شارع الشحن الجوي مباشرة تصلح لمجمع تجاري ومكاتب وهناجر 		/uploads/6c84bf61-0b62-441a-bfa3-5d702ce438bf-lg.webp	admin	2026-10-03 12:27:15.279	2026-10-04 14:41:14.802	9	محافظة العاصمة	المشتى	جدول الأحياء	اراضي جنوب عمان	50	DLS Smart Land Plan	2026-10-03 12:30:29.696	31.747374	35.989913		RQG2FXGEJV	f	{}	t
9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	SH-QAS-0003	أرض صناعية في القسطل صناعات خفيفه وبجانبها ٣ قطع بمجموع ٨ دونم او ست دونم او اربع دونمات 	القسطل	أرض صناعية	light	sale	8,000.89 م² · 8.001 دونم	60	شرقي الخط(1)	706, 707, 708, 709	31.743465, 35.964552	0799996668	available	published	t	owner	احمد سامي حسن الشنتف	f	منطقة صناعات غذائية ودوائية	تم إنشاء العرض من طلب المراجعة ff316e89-3248-4c35-8403-5b516bbd703a	/uploads/270528c7-1ad3-47ac-8f0e-6e9eb9851ff2-lg.webp	review	2026-09-30 16:10:20.037	2026-10-05 07:06:24.915	9	محافظة العاصمة	القسطل	جدول الأحياء	اراضي جنوب عمان	40	DLS Smart Land Plan	2026-10-01 10:15:41.537	31.743465	35.964552		DRJMWA5MH8	t	{}	f
\.


--
-- Data for Name: ListingView; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."ListingView" (id, "listingId", "visitorId", "viewedAt") FROM stdin;
cf283e19-851f-44ab-a095-3a122f7da4c8	6d9225f8-3212-4bd2-9f4e-8259b908a392	7af5d892-0581-4aa1-8133-7410843a7cd3	2026-10-02 21:05:03.573
c2be5683-7f8a-4d4c-9d7e-7391ecd59277	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	7af5d892-0581-4aa1-8133-7410843a7cd3	2026-10-02 21:05:18.488
a4a49fa1-3d2c-4de1-95cc-5405d95222ab	457f5d97-fa91-4c82-828b-bad4ee438c0f	85bfdec4-4e88-405e-91bc-fa5379d1e564	2026-09-30 06:20:27.393
dff3e640-79c1-4926-bb9f-e9a39ac7b801	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	6438b5c8-5a37-4046-b7ba-22b2d7af852b	2026-09-30 13:00:09.935
e8332813-d97f-43b9-870a-bfe6095cde01	16a57904-66e1-4f16-a159-2745c006f322	6438b5c8-5a37-4046-b7ba-22b2d7af852b	2026-10-05 11:51:52.365
e79208dc-3fd8-449e-970f-c42dee49bc12	e87a4745-15c6-40de-aa1a-a1d5829c77a7	83ec676f-61a1-4999-af78-5142fa951db0	2026-10-03 08:25:25.926
1972852f-e1d2-46b8-963b-8a91558f7805	6d9225f8-3212-4bd2-9f4e-8259b908a392	83ec676f-61a1-4999-af78-5142fa951db0	2026-10-03 08:47:42.853
e4f76edd-cc0c-48df-96d8-ccd1c474d788	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	83ec676f-61a1-4999-af78-5142fa951db0	2026-10-03 08:48:24.178
76969abe-831c-432c-ba6a-daa18ae2d809	670b7555-096b-46f8-9374-46a6774815bd	34faf144-877b-474b-a4cd-2e735a5cc4b0	2026-10-04 10:35:57.449
1b433b4d-4192-4dfb-ac5b-dc7c8c8a2952	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	174c48c7-bb7b-40ae-9707-72a1d4ba046b	2026-10-03 09:32:29.432
93673b14-744f-45d0-955f-1ae1d9924e1a	670b7555-096b-46f8-9374-46a6774815bd	8ccafcd5-ec22-45fc-a4b4-6fc9f5f671ae	2026-10-04 10:47:51.657
89222919-4f71-42af-b2a2-82d3ea9873d0	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	361a4623-072c-4e37-a933-4f69685c4ca2	2026-10-04 10:55:49.858
b22bcdc0-5ca5-455e-9479-28496344acc1	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	bde21a7a-88a1-4cfa-831b-1cd856f84945	2026-10-04 11:15:59.298
eb53970c-aa79-4888-8ece-a688a69d0243	670b7555-096b-46f8-9374-46a6774815bd	362cfee1-48e3-4d2f-843f-47589fbb49dd	2026-10-04 14:39:09.402
1ea5df3f-9d89-41e5-82b5-c6b50a708d10	16a57904-66e1-4f16-a159-2745c006f322	85bfdec4-4e88-405e-91bc-fa5379d1e564	2026-10-05 07:03:18.347
b9fa430c-879f-4b31-bd54-4a512f06adf4	2499eb33-f344-4cb4-80b3-bf991e686f39	85bfdec4-4e88-405e-91bc-fa5379d1e564	2026-10-05 07:03:38.419
5dea770b-d5d4-44af-9e52-135e5fc819a7	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	85bfdec4-4e88-405e-91bc-fa5379d1e564	2026-10-05 07:06:24.912
c5205bf4-6e05-4fd5-86ff-f7e86e9abb79	16a57904-66e1-4f16-a159-2745c006f322	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-05 08:31:21.352
a61017db-08e9-4963-8254-cda3d98b09d8	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	8be170fe-f7b1-455b-826a-1a2a19c6f36a	2026-09-29 11:32:28.923
344364fc-5ffd-452c-99f3-2c9b1def0fe1	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	85bfdec4-4e88-405e-91bc-fa5379d1e564	2026-09-29 11:34:12.466
db2b6de7-d2f7-4ab8-955e-4d078ad0c1d5	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	7af5d892-0581-4aa1-8133-7410843a7cd3	2026-09-30 14:35:51.278
4ea6efd1-fca9-43dd-9e3b-b4bbbf176b86	457f5d97-fa91-4c82-828b-bad4ee438c0f	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-05 10:11:50.74
220bbb36-2094-42d8-80d7-fc9c8f170a33	2499eb33-f344-4cb4-80b3-bf991e686f39	83ec676f-61a1-4999-af78-5142fa951db0	2026-10-03 11:59:07.791
44fdbb0d-12fa-4543-980b-16f377e96947	90580de3-7818-42df-acbf-5c492550166d	34faf144-877b-474b-a4cd-2e735a5cc4b0	2026-09-30 17:05:48.958
3f6d7282-31f8-4e58-9250-5d7aa4bda150	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	361a4623-072c-4e37-a933-4f69685c4ca2	2026-09-29 12:33:41.3
7956438d-872a-4a40-bb1a-d1c9271abbbb	d38c28d8-a66c-486d-8406-986fa939c5d0	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-09-30 22:56:32.368
a5858f0d-e71b-4195-9ad6-5b660d2fbfbf	71de6a57-f511-42ae-a67b-02c26f8c3f11	aee0f422-427e-4ad7-b869-c8315ed4e108	2026-10-01 09:13:31.387
545ff662-7f24-43a9-8562-6528463fc351	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	7af5d892-0581-4aa1-8133-7410843a7cd3	2026-10-01 17:59:43.158
bae3a3d9-624d-49d5-a96d-84bf002f17ad	457f5d97-fa91-4c82-828b-bad4ee438c0f	afd21380-b2c6-4b48-8fd7-3652c7e1deaf	2026-10-01 18:00:04.018
25eddd45-e4ad-4c1d-90f2-507940218107	6d9225f8-3212-4bd2-9f4e-8259b908a392	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-02 13:17:47.709
72a98f69-b51a-4245-999d-6cde7957e6e2	90580de3-7818-42df-acbf-5c492550166d	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-02 13:29:18.511
c630514a-9a56-4d2c-9591-165317c34c58	f493b4bb-c381-44aa-a674-deec39cf502a	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-02 13:30:44.262
eafd16ad-d5ed-4d2d-b775-2bdaea3727d0	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-02 14:05:10.212
3f987ead-8c26-4334-86f5-55cda1af1313	2499eb33-f344-4cb4-80b3-bf991e686f39	7af5d892-0581-4aa1-8133-7410843a7cd3	2026-10-03 12:15:36.643
27ec896f-767b-46a1-bb08-169fe4a26206	670b7555-096b-46f8-9374-46a6774815bd	6438b5c8-5a37-4046-b7ba-22b2d7af852b	2026-10-03 12:35:05.899
cd891d40-3180-4a94-a1c1-fdfcc362e643	2499eb33-f344-4cb4-80b3-bf991e686f39	361a4623-072c-4e37-a933-4f69685c4ca2	2026-10-03 12:36:40.536
a4248c07-294c-48e2-8aa0-b769210df7c7	670b7555-096b-46f8-9374-46a6774815bd	7af5d892-0581-4aa1-8133-7410843a7cd3	2026-10-03 12:36:42.983
85f4cc3d-529b-4392-9e6c-3cfa0334f508	670b7555-096b-46f8-9374-46a6774815bd	361a4623-072c-4e37-a933-4f69685c4ca2	2026-10-03 12:37:12.42
faf189ad-c455-4b20-aca1-b74762dc9064	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	8be170fe-f7b1-455b-826a-1a2a19c6f36a	2026-10-04 10:53:05.789
46706421-214b-4b68-8641-9bee70822c4f	670b7555-096b-46f8-9374-46a6774815bd	33e3486f-b82f-4dad-9c00-f197901deb75	2026-10-03 13:50:46.636
0f75490c-929b-4ade-9830-3d1477703442	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-05 12:04:41.197
72375025-04f8-4192-bdf4-485d7a7ceaee	670b7555-096b-46f8-9374-46a6774815bd	99f86d7a-3c48-4da0-ab7c-2f828f0db94e	2026-10-04 14:41:14.797
e650b1d1-0240-4b9a-8b69-7b93f6163e69	2499eb33-f344-4cb4-80b3-bf991e686f39	99f86d7a-3c48-4da0-ab7c-2f828f0db94e	2026-10-04 14:45:14.723
ed509d25-5a6d-45ab-aa99-74b2a960b210	16a57904-66e1-4f16-a159-2745c006f322	34faf144-877b-474b-a4cd-2e735a5cc4b0	2026-10-05 07:36:13.217
81c6b133-2631-47e0-8085-11c69a3bfd58	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	362cfee1-48e3-4d2f-843f-47589fbb49dd	2026-10-04 00:39:41.733
de7bd818-efb7-4910-9296-7190c5764171	670b7555-096b-46f8-9374-46a6774815bd	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-04 09:14:53.571
03b75177-eaa4-4da3-97b5-23d16902e89e	2499eb33-f344-4cb4-80b3-bf991e686f39	cd17ae0b-0d7c-492e-8873-788752d2ced3	2026-10-05 08:52:18.712
d89df16c-4dd9-43cb-8ce8-64903bbdb893	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	6438b5c8-5a37-4046-b7ba-22b2d7af852b	2026-10-05 12:24:09.202
\.


--
-- Data for Name: Media; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."Media" (id, "listingId", url, kind, "position", "createdAt") FROM stdin;
581aea15-8629-4f72-a99a-8157af17e847	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	/uploads/5b4a9d32-8727-4d67-9737-202b95fb8b61-lg.webp	image	0	2026-10-01 10:22:48.4
5b44920e-44a3-4e2b-a726-b0f14469c58b	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	/uploads/ede59f0a-ed62-413c-8a2c-99f84ee858a9-lg.webp	image	1	2026-10-01 10:22:48.4
8649a7a0-b6b2-4f40-b643-c2720fca70c3	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	/uploads/65a4db08-5aa3-4b37-8443-6f9bac3b67a1-lg.webp	image	2	2026-10-01 10:22:48.4
80b467ea-03fb-4e37-b000-61c6dbaa77a1	670b7555-096b-46f8-9374-46a6774815bd	/uploads/6c84bf61-0b62-441a-bfa3-5d702ce438bf-lg.webp	image	0	2026-10-03 12:34:46.198
4f5364e5-fe25-4b9d-8767-bcc57bd679cd	670b7555-096b-46f8-9374-46a6774815bd	/uploads/2b1f7760-76cc-4f67-86ac-bcda6bc8fe43.pdf	document	0	2026-10-03 12:34:46.198
e2514553-7a6f-476d-b08c-dee0e4a40153	16a57904-66e1-4f16-a159-2745c006f322	/uploads/e725d02d-2f57-497b-a9d6-a0babf6cc20a-lg.webp	image	0	2026-10-05 11:04:29.521
17d530fe-cdd7-41e1-83e4-472217778944	16a57904-66e1-4f16-a159-2745c006f322	/uploads/60ed0ab6-c271-46c3-a8e8-239475348203-lg.webp	image	1	2026-10-05 11:04:29.521
d591a3d9-0f80-4773-823a-078937b8e2e3	16a57904-66e1-4f16-a159-2745c006f322	/uploads/59d98f5d-7856-49b9-9cdb-d7df4508034a-lg.webp	image	2	2026-10-05 11:04:29.521
f478ec97-7cb7-426d-83dd-3885f7622f84	90580de3-7818-42df-acbf-5c492550166d	/uploads/57605ae4-f18c-4267-8683-326ee195a83c-lg.webp	image	0	2026-10-01 10:12:48.857
38f18112-3368-45c3-af4d-f73eafd59c9c	90580de3-7818-42df-acbf-5c492550166d	/uploads/228f4392-24b6-431e-a2c3-9c3a38b3ff73-lg.webp	image	1	2026-10-01 10:12:48.857
9db87872-2489-45a3-a1e3-1ba646cb9938	90580de3-7818-42df-acbf-5c492550166d	/uploads/e4a30b0b-4cfc-4d00-8983-a5887655a4d5-lg.webp	image	2	2026-10-01 10:12:48.857
f6955d17-53c8-43b3-a3a1-8919d22d90ee	e87a4745-15c6-40de-aa1a-a1d5829c77a7	/uploads/1aeadc60-e89c-420e-b915-ac68328872ac-lg.webp	image	0	2026-10-01 10:20:39.015
3358a624-ad11-42bc-acf3-5b95f2b721aa	e87a4745-15c6-40de-aa1a-a1d5829c77a7	/uploads/1ee29c9f-1c4d-4db6-aa48-03e73869b159-lg.webp	image	1	2026-10-01 10:20:39.015
4a966aa1-b8fd-445a-9150-eba771c55434	e87a4745-15c6-40de-aa1a-a1d5829c77a7	/uploads/99ff120f-df9e-47fb-917f-fd4bb3eb945b-lg.webp	image	2	2026-10-01 10:20:39.015
b881c234-5e89-40de-8256-2bee892b4f34	e87a4745-15c6-40de-aa1a-a1d5829c77a7	/uploads/66233dbd-be32-491c-bb9d-2ce86e3bf55c.mp4	video	0	2026-10-01 10:20:39.015
07982578-76b7-448b-81af-00d31e98cd50	6d9225f8-3212-4bd2-9f4e-8259b908a392	/uploads/1bad1b65-c75b-4135-ad9f-0b2dd03960d6-lg.webp	image	0	2026-09-30 17:15:09.588
83606f2b-b700-4601-84b8-94eaa380ca17	6d9225f8-3212-4bd2-9f4e-8259b908a392	/uploads/7ecfc1f0-9512-469c-b0ec-d9919f3e45f3.pdf	document	0	2026-09-30 17:15:09.588
cf6f84d7-2d38-420c-91ee-8876967a0961	f493b4bb-c381-44aa-a674-deec39cf502a	/uploads/a61fedd5-6fb8-458e-b1b2-608f8f1aa72a-lg.webp	image	0	2026-09-30 17:16:06.195
29c0f25d-b542-4254-a0fd-39f078b5fa9b	f493b4bb-c381-44aa-a674-deec39cf502a	/uploads/d401c1cf-60ec-4564-9971-8c4dce792cd0-lg.webp	image	1	2026-09-30 17:16:06.195
d87359dd-cc12-424c-ba9a-f22e23d38277	f493b4bb-c381-44aa-a674-deec39cf502a	/uploads/a83882de-bed8-4318-a706-a352f57721c3-lg.webp	image	2	2026-09-30 17:16:06.195
8ffe56c6-ae9f-4b98-bfa2-1d4cc0450539	810e5588-7520-4047-a983-e5ddedf9c644	/uploads/4b679ba7-da73-4479-89a2-2936b79b1592-lg.webp	image	0	2026-10-01 10:20:58.993
bc2da19a-6e5b-4e66-b410-67be8c7161ea	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	/uploads/a91e9429-ff1f-4055-8cd9-1f4a80f7c997-lg.webp	image	0	2026-09-30 16:23:27.008
c6300e13-6f6f-4c82-a962-599a23b03ddd	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	/uploads/cb65a663-5e0d-46a7-a492-be57d8e09861-lg.webp	image	1	2026-09-30 16:23:27.008
b9912d33-b428-47d5-a0b2-43aec968aa30	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	/uploads/0f73ede8-3b68-472c-8909-9e6e528d59d0-lg.webp	image	2	2026-09-30 16:23:27.008
b460d861-8231-47dd-84cb-69da740138b7	810e5588-7520-4047-a983-e5ddedf9c644	/uploads/5a2d3fcc-f3eb-4c42-bc2f-4b40f5cd082b-lg.webp	image	1	2026-10-01 10:20:58.993
46e38c34-8b0b-4c15-ba20-7c178a96173a	810e5588-7520-4047-a983-e5ddedf9c644	/uploads/1cd78e87-9098-4bbe-82f6-f0c238d9c1bf-lg.webp	image	2	2026-10-01 10:20:58.993
76fca8c9-44bf-46d1-878a-6316fcbc5717	2499eb33-f344-4cb4-80b3-bf991e686f39	/uploads/a2bfad53-2a61-4a9a-9b56-85910fa16caf-lg.webp	image	0	2026-10-03 09:47:10.666
b9ec5039-aa51-487e-bee1-e86c9ac17d3c	2499eb33-f344-4cb4-80b3-bf991e686f39	/uploads/f6b0e179-18b8-4b9f-ba79-cef3c24f111b.pdf	document	0	2026-10-03 09:47:10.666
ac23b875-59c4-4922-8139-e1bbef43fdc6	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	/uploads/11c2337f-e928-433b-b034-674443379df3-lg.webp	image	0	2026-10-01 10:14:45.742
a3b0f738-dcc5-4250-9cc7-c5a9a8a5e739	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	/uploads/022435cd-94cc-47a1-ada3-d5202d86528e-lg.webp	image	1	2026-10-01 10:14:45.742
d2bbd71c-3de6-452e-bf21-970be01f026c	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	/uploads/b99b664b-5ddb-4988-bacc-f6783ecd2c8e-lg.webp	image	2	2026-10-01 10:14:45.742
3430d513-0ace-4508-bf58-c394715b90a1	457f5d97-fa91-4c82-828b-bad4ee438c0f	/uploads/a7eb3c41-37de-4b85-b6ff-35e3a03ab574-lg.webp	image	0	2026-10-01 10:15:25.142
8ef23eb1-e31c-4864-afd0-9a6f453e83a3	457f5d97-fa91-4c82-828b-bad4ee438c0f	/uploads/88f5424e-804f-4f7f-bc6f-902dbd575986-lg.webp	image	1	2026-10-01 10:15:25.142
d60bb54a-bb3c-487a-8a19-fb345659ced5	457f5d97-fa91-4c82-828b-bad4ee438c0f	/uploads/99417bc9-d452-43f5-9669-cfb656ea8e7b-lg.webp	image	2	2026-10-01 10:15:25.142
0bda380c-d2fe-4118-b514-6f83cb7499aa	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	/uploads/270528c7-1ad3-47ac-8f0e-6e9eb9851ff2-lg.webp	image	0	2026-10-01 10:16:26.365
c2f229e5-72e6-444f-ac9c-044770b7b845	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	/uploads/a8fa8f3d-03e3-4014-98be-4936aeb1772b.pdf	document	0	2026-10-01 10:16:26.365
ce61da79-c0c4-4470-92f5-294548d427f5	71de6a57-f511-42ae-a67b-02c26f8c3f11	/uploads/bd713995-b57b-4c40-999f-dd53f858ee67-lg.webp	image	0	2026-10-01 10:16:42.639
3a6813df-fed2-4671-aeab-d9a66ed0f5d0	71de6a57-f511-42ae-a67b-02c26f8c3f11	/uploads/a077bb9f-3c62-4ad8-9816-0db25e9fc457-lg.webp	image	1	2026-10-01 10:16:42.639
a7205a08-7a48-40d7-ab61-3583db32bc0b	71de6a57-f511-42ae-a67b-02c26f8c3f11	/uploads/519f34b6-37a1-4f44-836b-6d73728a734b-lg.webp	image	2	2026-10-01 10:16:42.639
7eceee8b-507a-45b2-920f-d697efb311dd	d38c28d8-a66c-486d-8406-986fa939c5d0	/uploads/ad9ae5a6-eae5-4b7b-b149-fe27d26752ed-lg.webp	image	0	2026-10-01 10:17:51.588
94c76b71-509e-448d-ba2d-4645147f8176	d38c28d8-a66c-486d-8406-986fa939c5d0	/uploads/d2112016-af26-4bd5-a623-99bc9d0f4698-lg.webp	image	1	2026-10-01 10:17:51.588
815143fe-1722-4b1b-8b00-fe96fb9ff004	d38c28d8-a66c-486d-8406-986fa939c5d0	/uploads/bb0abafb-ed99-4958-9d75-2b057f866244-lg.webp	image	2	2026-10-01 10:17:51.588
\.


--
-- Data for Name: Setting; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."Setting" (key, value, "updatedAt") FROM stdin;
whatsappNumber	962799996668	2026-09-17 13:43:25.878
facebookUrl	https://facebook.com/Alshantaf.RealeEstate	2026-09-17 13:43:25.879
contactPhone2	+962 79 999 6660	2026-09-17 13:43:25.878
contactPhone1	+962 79 999 6668	2026-09-17 13:43:25.883
maintenanceBanner		2026-09-17 13:43:25.878
submissionsEnabled	true	2026-09-17 13:43:25.878
contactEmail	ahmad@alshantaf.com	2026-09-17 13:43:25.878
\.


--
-- Data for Name: StandbyImage; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."StandbyImage" (id, url, title, "createdAt") FROM stdin;
\.


--
-- Data for Name: Submission; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."Submission" (id, source, applicant, phone, office, whatsapp, email, "authExpiry", governorate, village, basin, parcel, neighborhood, coordinates, area, price, "industryType", activity, details, duplicate, status, reviewer, "reviewNote", "submittedAt", "reviewedAt", "convertedListingId", document, images, video, "serialNo", "trackingCode", directorate, latitude, longitude, address, "administrativeValue", "administrativeValueSource", "administrativeValueAt", "dlsKey") FROM stdin;
c82808b3-eaaa-418a-a57f-845b3c8c357c	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	702	جدول الأحياء	31.743820, 35.962798	3,318.92 م² · 3.319 دونم	\N	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-29 11:35:30.479	2026-09-30 16:11:38.172	d38c28d8-a66c-486d-8406-986fa939c5d0	\N	{/uploads/ad9ae5a6-eae5-4b7b-b149-fe27d26752ed-lg.webp,/uploads/d2112016-af26-4bd5-a623-99bc9d0f4698-lg.webp,/uploads/bb0abafb-ed99-4958-9d75-2b057f866244-lg.webp}	\N	REQ-00013	AR3REXSQ83	اراضي جنوب عمان	31.74382	35.962798	\N	40	DLS Smart Land Plan	2026-09-29 11:10:19.726	002200100000702
a7751617-5b2e-4b48-bb55-d8fa405e0d5c	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	707	جدول الأحياء	31.743436, 35.964911	2,000.22 م² · 2 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	t	approved	Alshantaf Admin	\N	2026-09-24 11:12:38.936	2026-09-30 16:12:01.117	f493b4bb-c381-44aa-a674-deec39cf502a	\N	{/uploads/d401c1cf-60ec-4564-9971-8c4dce792cd0-lg.webp,/uploads/a83882de-bed8-4318-a706-a352f57721c3-lg.webp}	\N	REQ-00010	84B8VCKDFR	اراضي جنوب عمان	31.743436	35.964911	\N	40	DLS Smart Land Plan	2026-09-24 11:12:11.662	002200100000707
1cf7d931-2753-44f8-b740-541eac5bd424	owner	x	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	x	f	rejected	Alshantaf Admin	\N	2026-09-14 14:47:37.272	2026-10-01 10:29:15.59	\N	\N	{}	\N	REQ-00001	LEGACY000001	\N	\N	\N	\N	\N	\N	\N	\N
1b6e6b58-81b9-4d71-98ae-ade298739b09	owner	Prod Test	0799999999	\N	\N	\N	\N	عمان	تجريبي	9	9	\N	\N	\N	\N	\N	\N	production smoke test	f	rejected	Alshantaf Admin	\N	2026-09-14 14:49:59.263	2026-10-01 10:29:20.887	\N	\N	{/uploads/6759f7f1-0990-47b9-b4e1-aea9fcca82a9.webp}	\N	REQ-00002	LEGACY000002	\N	\N	\N	\N	\N	\N	\N	\N
fdcfa0e7-3659-4d19-9c87-99a9cd95e343	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	698	جدول الأحياء	31.744194, 35.964177	1,999.96 م² · 2 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-29 11:05:08.134	2026-09-29 11:25:28.804	2e918bd0-5d89-4cc8-9b3b-3dc603f35c7d	\N	{/uploads/a91e9429-ff1f-4055-8cd9-1f4a80f7c997-lg.webp,/uploads/cb65a663-5e0d-46a7-a492-be57d8e09861-lg.webp,/uploads/0f73ede8-3b68-472c-8909-9e6e528d59d0-lg.webp}	\N	REQ-00011	6WDSK5UEBE	اراضي جنوب عمان	31.744194	35.964177	\N	40	DLS Smart Land Plan	2026-09-29 10:58:28.397	002200100000698
b19517fe-eb25-4264-85b0-50a90993a499	owner	waleed najim	0796873474	\N	\N	\N	\N	amman	al qastal	1 east 	699	jad	34.2828,34.282828	\N	1000000	medium	pharma	testing 	f	approved	Alshantaf Admin	\N	2026-09-14 14:59:35.118	2026-10-01 10:28:55.387	7dbcfffc-f2ab-4023-807a-aac7fdf11278	\N	{}	\N	REQ-00003	LEGACY000003	\N	\N	\N	\N	\N	\N	\N	\N
75112d32-07f9-43d5-a55f-55ad493f5baf	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	699	جدول الأحياء	31.744278, 35.963845	1,999.96 م² · 2 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-29 11:09:34.497	2026-09-30 16:11:51.014	2e7351ac-bb06-46a2-a6be-efb0fd5ce1a5	\N	{/uploads/11c2337f-e928-433b-b034-674443379df3-lg.webp,/uploads/022435cd-94cc-47a1-ada3-d5202d86528e-lg.webp,/uploads/b99b664b-5ddb-4988-bacc-f6783ecd2c8e-lg.webp}	\N	REQ-00012	599594BUE5	اراضي جنوب عمان	31.744278	35.963845	\N	40	DLS Smart Land Plan	2026-09-29 11:06:09.125	002200100000699
7a843f1d-3b8d-4b03-abec-56d5f10329d6	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	709	جدول الأحياء	31.743371, 35.965692	2,000.22 م² · 2 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-24 11:09:51.551	2026-09-30 16:12:07.695	fe45a8a2-17f3-4da7-9d6a-7122ff8a2e58	\N	{/uploads/ede59f0a-ed62-413c-8a2c-99f84ee858a9-lg.webp,/uploads/65a4db08-5aa3-4b37-8443-6f9bac3b67a1-lg.webp}	\N	REQ-00009	7YEAFERPDE	اراضي جنوب عمان	31.743371	35.965692	\N	40	DLS Smart Land Plan	2026-09-24 11:07:31.684	002200100000709
89174abf-ea61-44b1-a0fd-590acb25e423	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	708	جدول الأحياء	\N	2,000.23 م² · 2 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-24 11:06:30.741	2026-09-30 16:12:13.354	71de6a57-f511-42ae-a67b-02c26f8c3f11	\N	{/uploads/a077bb9f-3c62-4ad8-9816-0db25e9fc457-lg.webp,/uploads/519f34b6-37a1-4f44-836b-6d73728a734b-lg.webp}	\N	REQ-00008	WKMZCHJ9NY	اراضي جنوب عمان	\N	\N	\N	40	DLS Smart Land Plan	2026-09-24 11:02:28.737	\N
5dc535e3-40ab-4f28-8b53-8609bc72f592	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	707	جدول الأحياء	\N	2,000.23 م² · 2 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-24 11:01:10.836	2026-09-30 16:12:19.508	810e5588-7520-4047-a983-e5ddedf9c644	\N	{/uploads/5a2d3fcc-f3eb-4c42-bc2f-4b40f5cd082b-lg.webp,/uploads/1cd78e87-9098-4bbe-82f6-f0c238d9c1bf-lg.webp,/uploads/4b679ba7-da73-4479-89a2-2936b79b1592-lg.webp}	\N	REQ-00007	MR3KPMXEET	اراضي جنوب عمان	\N	\N	\N	40	DLS Smart Land Plan	2026-09-24 10:57:32.457	\N
cd36f13d-bc46-4e08-82d5-fa1ec1e42af4	owner	hfgddmgf	0799996668	\N	\N	\N	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	681	جدول الأحياء	https://maps.app.goo.gl/b12wpRm5PyhQC6p49	\N	93500	mediumSpecial	logistics	hbkmfgv,kifg	t	rejected	Alshantaf Admin	\N	2026-09-16 09:03:52.728	2026-10-03 09:43:12.77	16a57904-66e1-4f16-a159-2745c006f322	\N	{}	\N	REQ-00005	KW4T9YZV5P	\N	\N	\N	\N	\N	\N	\N	\N
63d09938-cae0-4005-b508-a5dbc64d9c85	owner	hfgddmgf	0799996668	\N	\N	\N	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	681	جدول الأحياء	https://maps.app.goo.gl/b12wpRm5PyhQC6p49	\N	93500	mediumSpecial	logistics	;ujh,fvgdcm,xdmfxm	f	approved	Alshantaf Admin	\N	2026-09-16 09:02:41.487	2026-10-01 10:25:54.874	\N	\N	{}	\N	REQ-00004	Q97CDP63Y8	\N	\N	\N	\N	\N	\N	\N	\N
c1336666-30da-4b4c-b8e8-1c7e1b57c9cd	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	704	جدول الأحياء	31.743525, 35.963833	2,000.23 م² · 2 دونم	\N	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-29 12:11:48.571	2026-09-29 13:43:14.187	457f5d97-fa91-4c82-828b-bad4ee438c0f	\N	{/uploads/a7eb3c41-37de-4b85-b6ff-35e3a03ab574-lg.webp,/uploads/88f5424e-804f-4f7f-bc6f-902dbd575986-lg.webp,/uploads/99417bc9-d452-43f5-9669-cfb656ea8e7b-lg.webp}	\N	REQ-00014	65UN8EQQDF	اراضي جنوب عمان	31.743525	35.963833	\N	40	DLS Smart Land Plan	2026-09-29 11:36:08.586	002200100000704
c6079e25-84ac-4bc1-996f-928e748ea100	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	706	جدول الأحياء	31.743465, 35.964552	2,000.23 م² · 2 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-24 10:52:34.488	2026-09-30 16:12:27.215	e87a4745-15c6-40de-aa1a-a1d5829c77a7	\N	{/uploads/1ee29c9f-1c4d-4db6-aa48-03e73869b159-lg.webp,/uploads/99ff120f-df9e-47fb-917f-fd4bb3eb945b-lg.webp,/uploads/1aeadc60-e89c-420e-b915-ac68328872ac-lg.webp}	/uploads/66233dbd-be32-491c-bb9d-2ce86e3bf55c.mp4	REQ-00006	3DXXPJF2BS	اراضي جنوب عمان	31.743465	35.964552	\N	40	DLS Smart Land Plan	2026-09-24 07:48:06.412	002200100000706
4b51af42-1eb6-4b43-b540-84578238043e	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	606, 607, 608	جدول الأحياء	\N	6,000.4 م² · 6 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-29 12:33:25.592	2026-09-30 16:10:50.691	6d9225f8-3212-4bd2-9f4e-8259b908a392	/uploads/7ecfc1f0-9512-469c-b0ec-d9919f3e45f3.pdf	{/uploads/1bad1b65-c75b-4135-ad9f-0b2dd03960d6-lg.webp}	\N	REQ-00016	XY4WWJMSPF	اراضي جنوب عمان	\N	\N	\N	\N	\N	\N	\N
fcf79aef-3da8-4a01-b992-39f79d590f70	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	706, 708	جدول الأحياء	31.749618, 35.933921	4,000.4 م² · 4 دونم	60	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-29 12:27:52.457	2026-09-30 16:11:10.25	2499eb33-f344-4cb4-80b3-bf991e686f39	/uploads/f6b0e179-18b8-4b9f-ba79-cef3c24f111b.pdf	{/uploads/a2bfad53-2a61-4a9a-9b56-85910fa16caf-lg.webp}	\N	REQ-00015	ARTRYE929H	اراضي جنوب عمان	31.749618	35.933921	\N	\N	\N	\N	\N
ff316e89-3248-4c35-8403-5b516bbd703a	owner	احمد سامي حسن الشنتف	0799996668	\N	\N	ahmad@alshantaf.com	\N	محافظة العاصمة	القسطل	شرقي الخط(1)	706, 707, 708, 709	جدول الأحياء	\N	8,000.4 م² · 8 دونم	\N	light	\N	منطقة صناعات غذائية ودوائية\r\n\r\n	f	approved	Alshantaf Admin	\N	2026-09-29 12:38:58.1	2026-09-30 16:10:20.047	9a1a4bf3-115c-4222-a2a0-5b42a4d1c9fc	/uploads/a8fa8f3d-03e3-4014-98be-4936aeb1772b.pdf	{/uploads/270528c7-1ad3-47ac-8f0e-6e9eb9851ff2-lg.webp}	\N	REQ-00017	7BE5GYJ8R8	اراضي جنوب عمان	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public."User" (id, email, "passwordHash", name, "createdAt", phone, whatsapp, permissions) FROM stdin;
5bb64949-c216-4876-8a75-61be3aaa3771	ahmad@alshantaf.com	$2a$12$fiGEGQ2aoPeZDfdapqjawOLNjKQfMe0QzJzj53pXJS5fFwj9AjpAG	Eng.Ahmad al shantaf	2026-09-15 15:33:48.638	+962799996668	+962799996668	{*}
823219a6-d2c3-4cba-a55a-071612c1a6f3	mohammad@alshantaf.com	$2a$12$NivbOdcPrQGt1SIfNjlGaezeCHfv1SdeDAKGNuQg0bHJw5TltOcEu	Eng.Mohammad al shantaf	2026-09-30 15:06:12.335	+962799996660	+962799996660	{*}
7250543d-a5d2-4d77-a4d0-ba148107bb35	ahmed@alwathbasteelfiber.com	$2a$12$Q4.L8mgJrLhLUOGovtawQeTuln0FzW0d6cg0IvQdewvscluKrUUE6	Alshantaf Admin	2026-09-14 13:44:13.282	\N	\N	{*}
bca57644-cef6-4294-bf08-cb0f702aea91	farah@alshantaf.com	$2a$12$4MmPU4krtIj7r88EJsEqsORKx0wsNtaAfASpSNwYbPXl.7M6.E9x6	Farah Shameh	2026-09-30 15:32:10.071	\N	\N	{listings,media}
ed6ba4bb-ae38-4086-9340-2ca09509bcad	admin@alshantaf.com	$2a$12$FWCB9bnIF22O0ygZG.379u.wnpjDk5mBD22OGUhMaIJ.kDZHbt83G	Alshantaf Admin	2026-09-15 09:00:05.336	\N	\N	{*}
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: alshantaf
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
21643277-77d6-4b31-80f6-5f97ebb41ac0	562b6e8a82623b19bab2acd27cbd40f8d754c86d495e640d89c5c4b3e1072600	2026-09-30 15:25:59.134118+00	20260930180000_admin_permissions	\N	\N	2026-09-30 15:25:59.110992+00	1
2727cd30-18eb-4775-968c-156d236e5882	3e2713842467b7cce1642b751ba388b4290235df02040849232b83065b7ef733	2026-09-14 13:44:12.456848+00	20260914111820_init	\N	\N	2026-09-14 13:44:12.423877+00	1
79f32a3e-ba32-409d-8857-a7fa26d48bf7	491220a2da683e878aed5783933bbb299a1865c759bdc7c516cb23c28fd8a658	2026-09-20 12:33:13.485473+00	20260920160000_listing_owner_sms	\N	\N	2026-09-20 12:33:13.47919+00	1
7200807e-276e-4fbd-bb66-b1f7d111d561	4840485700a852ab42fd5fb40705906f5112b30891d00ccb47b2fdaadf6c4f9c	2026-09-14 14:42:37.827779+00	20260914143517_submission_media	\N	\N	2026-09-14 14:42:37.819608+00	1
010d234e-efa4-4adf-ac72-80cbb791770e	2281565ed8c85e6cbb062b64e96152af1fb31fac757242fb41f270af6afded2e	2026-09-14 16:01:50.71302+00	20260914154421_admin_control_center	\N	\N	2026-09-14 16:01:50.69598+00	1
45f50fc4-b0e7-4b67-a471-e788f428d0be	ef807df5a2d37708a1f5840a0d73b7b8e67ad3d1769cb1b8383649dc9db53fb0	2026-09-15 12:52:37.884602+00	20260915120000_standby_images	\N	\N	2026-09-15 12:52:37.862541+00	1
874c8f9d-f6b3-4ee6-bd64-3263da13f4b7	b15696462a85e146c997ff3444e7ea8f1beb04dd21144c4559e5414c13de7ca0	2026-09-20 12:33:13.498129+00	20260920170000_contact_requests	\N	\N	2026-09-20 12:33:13.486091+00	1
d3bfe7f5-c239-4d11-bab1-ae6eb086e9b6	edf98dcd90b60caaa40dcc00244152da3621ee2d8861f60e2ebc8f875eff2ed2	2026-09-15 13:12:14.457948+00	20260915130407_add_industry_types	\N	\N	2026-09-15 13:12:14.451188+00	1
6b66b94e-fe72-4689-af10-f6ee0ece2426	2d35293dc7db61daf04773a508a599bd4b4f17bffcb3a5fb9ad5237ad39d41ab	2026-09-15 14:42:08.014609+00	20260915140108_add_tracking_and_views	\N	\N	2026-09-15 14:42:07.986886+00	1
685d17ce-da74-4a88-a8fc-38cbff163fc6	081021680ce3bda6337a1abc8ee8594aae2d3b860308d3470dfa76044559c6d4	2026-09-16 08:10:06.675703+00	20260916070000_admin_contact_fields	\N	\N	2026-09-16 08:10:06.669017+00	1
8fb16a74-718c-4f23-8536-2633dd9b8e68	16514d6ce951688713009eee31ad3d339adfd2617d1d75cf2d37dc5cd447f56f	2026-09-23 17:09:39.972963+00	20260923180000_land_check_drafts	\N	\N	2026-09-23 17:09:39.95379+00	1
05bd296e-663b-4ede-aee3-b18dc54d91be	11699cd1ef221abc471d93f4a85dba3c1f7bb74521654a3a45be08f5697cbae9	2026-09-16 08:10:06.67949+00	20260916080000_listing_location_fields	\N	\N	2026-09-16 08:10:06.67636+00	1
adce9212-2fed-4d05-a88f-9ba0ed1af8f2	6653cb6cd5ad582b1f68a1c84f36d5837e479bea51ddb3c2c462493efb72e648	2026-09-16 08:57:30.404203+00	20260916100000_directorate_fields	\N	\N	2026-09-16 08:57:30.397923+00	1
9a5eb10f-5dc3-4256-86b3-38ad38430e1c	3e825b0d944676fae389ca8f307cead4771027e7cde5961cd9ac411964dc0c16	2026-10-03 09:26:06.082031+00	20261003120000_fix_multiparcel_listing_size	\N	\N	2026-10-03 09:26:06.070864+00	1
55605a2b-55c1-4c2c-af1f-eb78f00c7dcf	6a630226ae4ae55989808341b7de7d547ea6201d1cb4cd7567118fd85027e8ac	2026-09-16 13:19:49.834532+00	20260916120000_dls_administrative_value	\N	\N	2026-09-16 13:19:49.828217+00	1
327b2e21-9134-474e-9bec-75e6afcc4b94	1893e8b0ce735f862a5861c73a8eb92392cd479425397af756513fd7e314ee64	2026-09-23 17:16:11.189429+00	20260923183000_residential_zoning_types	\N	\N	2026-09-23 17:16:11.181529+00	1
650f5e23-39f1-48c4-8c66-432d3b3f14b9	de189f74ec5671fae2aa2e690ae4e2cff0b0b1fc052799c77442f57f2039e551	2026-09-16 13:19:49.838478+00	20260916133000_structured_locations	\N	\N	2026-09-16 13:19:49.835207+00	1
09e14b79-1dcf-4bee-8a0c-7d11621a8466	e2b446bc7a101cb526b039588030ee89bc4328e2e70e9db478a5eea417f3fff6	2026-09-20 12:33:13.454939+00	20260920140000_submission_dls_fields	\N	\N	2026-09-20 12:33:13.447969+00	1
31f55eea-980a-4a00-8c4b-e36c5e4c2259	4a3216456dc03f68b2097f96fdc9441261d76f8b30933db12a3535c03dd3d4f1	2026-09-20 12:33:13.47854+00	20260920150000_land_checks	\N	\N	2026-09-20 12:33:13.455953+00	1
5a260ed1-7f4e-447f-a41f-175f866e1c98	bf6fa4bed17621495c208f888e1e11a0eade7b9bd1a644558f31f66bc58f1fd6	2026-09-23 17:26:22.87857+00	20260923190000_commercial_zoning_types	\N	\N	2026-09-23 17:26:22.872496+00	1
06064a3c-74c8-4708-b161-03b86a40b654	a2e5808c1453cf409edd6bdde906ad13d762f91b4dd185f7992d65a913014d66	2026-09-23 17:37:49.659674+00	20260923192000_amman_detailed_zoning	\N	\N	2026-09-23 17:37:49.653406+00	1
a152dadb-3a3b-4d37-b799-aa146d11dce4	959eca242f907601c8aacf75611cb0c8cfc9f1bf3e5a210c08637b315da56ee9	2026-10-04 09:30:43.284181+00	20261004123500_expand_regulation_classifications	\N	\N	2026-10-04 09:30:43.265224+00	1
d9d07436-2114-43c1-a191-438132eee439	a18075c8deb42a42130150be2f9bb9f2296b2c8ebb6d1b956af9874d4382cd65	2026-09-23 17:57:07.055864+00	20260923194000_commercial_outside_amman	\N	\N	2026-09-23 17:57:07.049459+00	1
00424584-4e6b-450b-90b6-772daab4d215	ba04847f65375b10dac2135072642325f63f4ce8930742db672576f644bad5aa	2026-09-29 12:17:55.231582+00	20260929120000_listing_show_estimated_value	\N	\N	2026-09-29 12:17:55.211806+00	1
dcea8b2b-894f-42f6-beda-4802fc980bff	f277853008e085bd97e3e49aefa679f738310b1faaa3fed4efa23f7439547868	2026-10-04 15:32:30.386367+00	20261004153500_residential_private_c	\N	\N	2026-10-04 15:32:30.376396+00	1
\.


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: ContactRequest ContactRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."ContactRequest"
    ADD CONSTRAINT "ContactRequest_pkey" PRIMARY KEY (id);


--
-- Name: LandCheck LandCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."LandCheck"
    ADD CONSTRAINT "LandCheck_pkey" PRIMARY KEY (id);


--
-- Name: ListingView ListingView_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."ListingView"
    ADD CONSTRAINT "ListingView_pkey" PRIMARY KEY (id);


--
-- Name: Listing Listing_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."Listing"
    ADD CONSTRAINT "Listing_pkey" PRIMARY KEY (id);


--
-- Name: Media Media_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."Media"
    ADD CONSTRAINT "Media_pkey" PRIMARY KEY (id);


--
-- Name: Setting Setting_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."Setting"
    ADD CONSTRAINT "Setting_pkey" PRIMARY KEY (key);


--
-- Name: StandbyImage StandbyImage_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."StandbyImage"
    ADD CONSTRAINT "StandbyImage_pkey" PRIMARY KEY (id);


--
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: ContactRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "ContactRequest_createdAt_idx" ON public."ContactRequest" USING btree ("createdAt");


--
-- Name: ContactRequest_serialNo_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "ContactRequest_serialNo_key" ON public."ContactRequest" USING btree ("serialNo");


--
-- Name: ContactRequest_status_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "ContactRequest_status_idx" ON public."ContactRequest" USING btree (status);


--
-- Name: LandCheck_clientKey_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "LandCheck_clientKey_key" ON public."LandCheck" USING btree ("clientKey");


--
-- Name: LandCheck_createdAt_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "LandCheck_createdAt_idx" ON public."LandCheck" USING btree ("createdAt");


--
-- Name: LandCheck_isDraft_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "LandCheck_isDraft_idx" ON public."LandCheck" USING btree ("isDraft");


--
-- Name: LandCheck_serialNo_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "LandCheck_serialNo_key" ON public."LandCheck" USING btree ("serialNo");


--
-- Name: LandCheck_status_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "LandCheck_status_idx" ON public."LandCheck" USING btree (status);


--
-- Name: LandCheck_village_basin_parcel_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "LandCheck_village_basin_parcel_idx" ON public."LandCheck" USING btree (village, basin, parcel);


--
-- Name: ListingView_listingId_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "ListingView_listingId_idx" ON public."ListingView" USING btree ("listingId");


--
-- Name: ListingView_listingId_visitorId_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "ListingView_listingId_visitorId_key" ON public."ListingView" USING btree ("listingId", "visitorId");


--
-- Name: Listing_area_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "Listing_area_idx" ON public."Listing" USING btree (area);


--
-- Name: Listing_listingNo_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "Listing_listingNo_key" ON public."Listing" USING btree ("listingNo");


--
-- Name: Listing_ownerAccessCode_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "Listing_ownerAccessCode_key" ON public."Listing" USING btree ("ownerAccessCode");


--
-- Name: Listing_publishStatus_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "Listing_publishStatus_idx" ON public."Listing" USING btree ("publishStatus");


--
-- Name: Listing_status_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "Listing_status_idx" ON public."Listing" USING btree (status);


--
-- Name: Media_listingId_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "Media_listingId_idx" ON public."Media" USING btree ("listingId");


--
-- Name: StandbyImage_createdAt_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "StandbyImage_createdAt_idx" ON public."StandbyImage" USING btree ("createdAt");


--
-- Name: StandbyImage_url_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "StandbyImage_url_key" ON public."StandbyImage" USING btree (url);


--
-- Name: Submission_serialNo_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "Submission_serialNo_key" ON public."Submission" USING btree ("serialNo");


--
-- Name: Submission_status_idx; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE INDEX "Submission_status_idx" ON public."Submission" USING btree (status);


--
-- Name: Submission_trackingCode_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "Submission_trackingCode_key" ON public."Submission" USING btree ("trackingCode");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: alshantaf
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: ListingView ListingView_listingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."ListingView"
    ADD CONSTRAINT "ListingView_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES public."Listing"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Media Media_listingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."Media"
    ADD CONSTRAINT "Media_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES public."Listing"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Submission Submission_convertedListingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: alshantaf
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_convertedListingId_fkey" FOREIGN KEY ("convertedListingId") REFERENCES public."Listing"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict iCI8Meend5d9qB1wbQy04EcFwfYyYIfiq5UNTvg7kf7qwat8Y6jZOSrPIsUGAuk

