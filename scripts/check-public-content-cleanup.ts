import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { getActiveSiteNotice, getHomeData } from "../src/lib/home-data";
import { getPublishedResources } from "../src/lib/public-data";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { slug: "swcu" },
    select: { id: true, slug: true, displayName: true },
  });
  const [notice, news, home, resources, activeNotice] = await Promise.all([
    db.siteNotice.findUnique({ where: { tenantId: tenant.id } }),
    db.newsNotice.findMany({ where: { tenantId: tenant.id } }),
    getHomeData(tenant),
    getPublishedResources(tenant),
    getActiveSiteNotice(tenant),
  ]);

  assert.ok(!notice?.isEnabled || !notice.message.includes("OPTIONAL scrolling message feature"), "Demo notice must not be enabled");
  assert.ok(!news.some((item) => item.title === "Test News" || item.title.startsWith("New SWCU Website is now live!")), "Test and premature news must not remain in SWCU DEV");
  assert.ok(!home.news.some((item) => item.title.startsWith("New SWCU Website is now live!")), "No premature Home news");
  assert.ok(!resources.news.some((item) => item.title.startsWith("New SWCU Website is now live!")), "No premature Forms & Resources news");

  if (news.length === 0) {
    assert.equal(home.news.length, 0, "Home has no news when the tenant has no records");
    assert.equal(resources.news.length, 0, "Forms & Resources has no news when the tenant has no records");
  }
  if (!notice?.isEnabled) assert.equal(activeNotice, null, "No public notice when disabled");

  console.log(JSON.stringify({
    script: "check-public-content-cleanup",
    newsRecords: news.length,
    publishedNews: news.filter((item) => item.isPublished).length,
    siteNoticeEnabled: notice?.isEnabled ?? false,
  }));
}

main().finally(() => db.$disconnect());