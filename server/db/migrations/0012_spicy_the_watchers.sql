CREATE TABLE "help_article" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"collection_id" uuid NOT NULL,
	"short_id" varchar(6) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(300),
	"content" text NOT NULL,
	"tsv" "tsvector" NOT NULL,
	"position" integer NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_collection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(200),
	"icon" varchar(32) NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "help_article" ADD CONSTRAINT "help_article_collection_id_help_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."help_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_help_article_org_shortid" ON "help_article" USING btree ("org_id","short_id");--> statement-breakpoint
CREATE INDEX "idx_help_article_collection" ON "help_article" USING btree ("collection_id","status","position","id");--> statement-breakpoint
CREATE INDEX "idx_help_article_org_status" ON "help_article" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_help_article_tsv" ON "help_article" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "idx_help_collection_org" ON "help_collection" USING btree ("org_id","position","id");