import { proxyAdminPost } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const POST = async (request: NextRequest) => proxyAdminPost(request, "/session/create");
