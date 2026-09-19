# Project Brief: The Met Archive

Status: product concept; Journey and Connections are the committed core pages.

Launch data source: **The Metropolitan Museum of Art** ([Collection API](https://metmuseum.github.io/) + [Open Access CSV](https://github.com/metmuseum/openaccess)), indexed in Supabase. Images are direct public-domain JPEGs (`primaryImage` / `primaryImageSmall`).

## The Idea

A searchable digital museum devoted to the things we usually overlook. Visitors enter a catalog subject (from Met tags), then follow a chronological Journey and explore Connections. Pitch: **What do you want to find in art?**

## Assessment Fit

Creative, API-Integrated Web App. Primary advanced feature: BFF + Supabase index (ingest, validation, connections). Secondary: signature motion. Supporting: shareable URL state.

## Core Pages

Search → Journey / Connections → inspection (`?artwork=`) → share.

## Launch

≥3 journey-ready subjects discovered from Met tags after validation (targets: flower, landscape, animal). Eligibility: public domain, usable JPEG, dated record, non-generic tag evidence.

## Out of Scope (v1)

Accounts, multiple museums, computer vision, copying image binaries into Storage, inventing art-historical essays, All Works browse page.
