import { proxyAdminGet } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export const GET = async (request: NextRequest) => {
    return proxyAdminGet(request, "/sessions");
};
