// Thẻ và quy tắc tự động: nhận dữ liệu từ landing, gắn thẻ, chạy quy tắc, giữ quyền theo email, kích hoạt, thu hồi.
import { and, eq } from 'drizzle-orm';
import { automationGrants, communityMembers, communityTiers, contacts, entitlements, users } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { register, verifyEmail } from '../auth/service';
import * as automation from '../services/automation';
import * as engine from '../services/automation-engine';
import { canAccessCourse } from '../services/entitlements';
import * as members from '../services/members';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
let kd = '';
let congsu = '';
let fbads = '';
let sourceUrl = '';
const tokenOf = (url: string) => url.split('/').pop()!;
const claimTokenIn = (html: string) => /kich-hoat\?token=([a-f0-9]+)/.exec(html)?.[1] ?? '';
const emailsTo = (to: string) => app.emails.filter((m) => m.to === to);

beforeAll(async () => {
  app = await createTestApp();
  kd = await app.ids('community:kd');
  congsu = await app.ids('community:congsu');
  fbads = await app.ids('course:fbads');
  const owner = await app.as('minhquy');
  sourceUrl = (await automation.createSource(owner, kd, { name: 'Landing Webcake' })).url;
}, 180_000);
afterAll(async () => {
  await app.close();
});

describe('nguồn đồng bộ', () => {
  it('địa chỉ nhận nằm dưới /webhooks/in và khóa sai thì 404', async () => {
    expect(sourceUrl).toMatch(/\/webhooks\/in\/[a-f0-9]{40}$/);
    await expect(automation.receiveInbound(app.system(), 'khong-co', { email: 'a@example.com' })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('thành viên thường và chủ hội khác không xem được nguồn', async () => {
    await expect(automation.listSources(await app.as('cong'), kd)).rejects.toMatchObject({ code: 'forbidden' });
    const yt = await app.ids('community:yt');
    await expect(automation.listSources(await app.as('minhquy'), yt)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('dữ liệu không có email thì ghi nhật ký lỗi; ghép trường rồi xử lý lại thì gắn được thẻ', async () => {
    const owner = await app.as('minhquy');
    const [src] = await automation.listSources(owner, kd);
    const r = await automation.receiveInbound(app.system(), tokenOf(sourceUrl), { form: { o_1: 'Chị Hoa', o_2: 'hoa(at)example.com', nhan: 'lead' }, lien_he: 'hoa.thu@example.com' });
    expect(r.status).toBe('processed');
    expect(r.email).toBe('hoa.thu@example.com');
    const bad = await automation.receiveInbound(app.system(), tokenOf(sourceUrl), { form: { o_1: 'Anh Nam', nhan: 'lead' } });
    expect(bad.status).toBe('failed');
    const events = await automation.listSourceEvents(owner, kd, src!.id);
    expect(events[0]!.fields).toEqual({ 'form.o_1': 'Anh Nam', 'form.nhan': 'lead' });
    await automation.updateSource(owner, kd, src!.id, { mapping: { tagPath: 'form.nhan' } });
    const again = await automation.reprocessEvent(owner, kd, events[1]!.id);
    expect(again.tagsAdded).toEqual(['lead']);
    await automation.updateSource(owner, kd, src!.id, { mapping: { tagPath: '' } });
  });

  it('nguồn tạm dừng thì nhận nhưng bỏ qua', async () => {
    const owner = await app.as('minhquy');
    const [src] = await automation.listSources(owner, kd);
    await automation.updateSource(owner, kd, src!.id, { status: 'paused' });
    const r = await automation.receiveInbound(app.system(), tokenOf(sourceUrl), { email: 'pause@example.com', tag: 'paid' });
    expect(r.status).toBe('ignored');
    expect(await app.ctx.db.query.contacts.findFirst({ where: eq(contacts.email, 'pause@example.com') })).toBeUndefined();
    await automation.updateSource(owner, kd, src!.id, { status: 'active' });
  });
});

describe('quy tắc: gắn thẻ thì mở khóa học và gửi email', () => {
  const email = 'khach.moi@example.com';
  let claim = '';

  it('chỉ nhận đích thuộc workspace của mình', async () => {
    const owner = await app.as('minhquy');
    const yt = await app.ids('community:yt');
    await expect(automation.createRule(owner, kd, { name: 'Sai', tag: 'x', actions: [{ type: 'grant_membership', communityId: yt, tierKey: 'premium', durationDays: null }] })).rejects.toMatchObject({ code: 'validation_error' });
    await expect(automation.createRule(owner, kd, { name: 'Sai', tag: 'x', actions: [{ type: 'grant_course', courseId: crypto.randomUUID() }] })).rejects.toMatchObject({ code: 'validation_error' });
    await expect(automation.createRule(owner, kd, { name: 'Rỗng', tag: 'x', actions: [] })).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('khách chưa có tài khoản: giữ quyền theo email và gửi email có link kích hoạt', async () => {
    const owner = await app.as('minhquy');
    await automation.createRule(owner, kd, { name: 'Mua Facebook Ads', tag: 'Paid FBAds', actions: [{ type: 'grant_course', courseId: fbads }, { type: 'send_email', subject: 'Chào {{name}}, khóa học đã mở', body: 'Cảm ơn {{name}} đã mua.\n\nVào học tại {{access_link}}' }] });
    const r = await automation.receiveInbound(app.system(), tokenOf(sourceUrl), { full_name: 'Khách Mới', phone_number: '0900000001', email, tag: 'paid_fbads' });
    expect(r).toMatchObject({ status: 'processed', email, tagsAdded: ['paid_fbads'] });
    expect(await app.ctx.db.query.users.findFirst({ where: eq(users.email, email) })).toBeUndefined();
    const contact = await app.ctx.db.query.contacts.findFirst({ where: eq(contacts.email, email) });
    expect(contact).toMatchObject({ name: 'Khách Mới', phone: '0900000001', linkedUserId: null });
    const [grant] = await app.ctx.db.query.automationGrants.findMany({ where: eq(automationGrants.contactId, contact!.id) });
    expect(grant).toMatchObject({ kind: 'course', resourceId: fbads, status: 'pending' });
    const [mail] = emailsTo(email);
    expect(mail!.subject).toBe('Chào Khách Mới, khóa học đã mở');
    expect(mail!.template).toBe('automation_email');
    expect(mail!.html).toContain('Kích hoạt và vào xem');
    expect(mail!.html).toContain('/webhooks/unsubscribe/');
    claim = claimTokenIn(mail!.html);
    expect(claim).not.toBe('');
  });

  it('gửi lặp lại cùng dữ liệu không chạy lại quy tắc', async () => {
    const before = emailsTo(email).length;
    const r = await automation.receiveInbound(app.system(), tokenOf(sourceUrl), { full_name: 'Khách Mới', email, tag: 'paid_fbads' });
    expect(r.tagsAdded).toEqual([]);
    expect(emailsTo(email)).toHaveLength(before);
  });

  it('trang kích hoạt cho biết sẽ mở gì; đặt mật khẩu xong thì có tài khoản, đăng nhập luôn và học được', async () => {
    const info = await engine.activationInfo(app.anon(), claim);
    expect(info).toMatchObject({ email, hasAccount: false, used: false, items: ['Khóa học Facebook Ads chuyển đổi 2026'] });
    await expect(engine.activate(app.anon(), app.auth, claim, { password: 'ngan' })).rejects.toMatchObject({ code: 'validation_error' });
    const r = await engine.activate(app.anon(), app.auth, claim, { password: 'matkhau-moi-123' });
    expect(r.session?.user.email).toBe(email);
    expect(r.redirect).toBe('/hoc');
    expect(r.granted).toEqual(['Khóa học Facebook Ads chuyển đổi 2026']);
    const user = await app.ctx.db.query.users.findFirst({ where: eq(users.email, email) });
    expect(user!.emailVerifiedAt).not.toBeNull();
    expect(user!.name).toBe('Khách Mới');
    expect((await canAccessCourse(app.anon(), user!.id, fbads)).allowed).toBe(true);
    // Không bị tự thêm vào hội: mua khóa học lẻ thì chỉ có quyền học.
    expect(await app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.userId, user!.id), eq(communityMembers.communityId, kd)) })).toBeUndefined();
  });

  it('link đã dùng không tạo được tài khoản thứ hai, bấm lại chỉ mời đăng nhập', async () => {
    const info = await engine.activationInfo(app.anon(), claim);
    expect(info).toMatchObject({ hasAccount: true, used: true, items: [] });
    const r = await engine.activate(app.anon(), app.auth, claim, {});
    expect(r.session).toBeNull();
    await expect(engine.activate(app.anon(), app.auth, 'sai-token', {})).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('gỡ thẻ (remove_tag từ landing) thì thu hồi khóa học', async () => {
    const user = await app.ctx.db.query.users.findFirst({ where: eq(users.email, email) });
    const r = await automation.receiveInbound(app.system(), tokenOf(sourceUrl), { email, remove_tag: 'paid_fbads' });
    expect(r.tagsRemoved).toEqual(['paid_fbads']);
    expect((await canAccessCourse(app.anon(), user!.id, fbads)).allowed).toBe(false);
    const runs = await automation.listRuns(await app.as('minhquy'), kd);
    expect(runs[0]).toMatchObject({ email, trigger: 'tag_removed' });
  });

  it('gắn lại thẻ cho người đã có tài khoản thì cấp thẳng, email dẫn tới chỗ học', async () => {
    const user = await app.ctx.db.query.users.findFirst({ where: eq(users.email, email) });
    const before = emailsTo(email).length;
    await automation.receiveInbound(app.system(), tokenOf(sourceUrl), { email, tag: 'paid_fbads' });
    expect((await canAccessCourse(app.anon(), user!.id, fbads)).allowed).toBe(true);
    const mail = emailsTo(email)[before]!;
    expect(mail.html).toContain('Vào xem ngay');
    expect(mail.html).not.toContain('kich-hoat');
  });
});

describe('quy tắc: gắn thẻ thì cho vào hội', () => {
  it('thành viên sẵn có được nâng gói có hạn; gỡ thẻ thì về gói mặc định', async () => {
    const owner = await app.as('minhquy');
    await automation.createRule(owner, kd, { name: 'VIP 30 ngày', tag: 'vip_30', actions: [{ type: 'grant_membership', communityId: kd, tierKey: 'premium', durationDays: 30 }] });
    const cong = await app.ids('user:cong');
    const premium = await app.ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, kd), eq(communityTiers.key, 'premium')) });
    const standard = await app.ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, kd), eq(communityTiers.key, 'standard')) });
    const memberOf = () => app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.userId, cong), eq(communityMembers.communityId, kd)) });
    const made = await automation.createContact(owner, kd, { email: 'CongTran@gmail.com', tags: ['vip_30'] });
    expect(made.tags[0]).toMatchObject({ tag: 'vip_30', added: true, rulesRun: 1 });
    expect((await memberOf())!.tierId).toBe(premium!.id);
    const ent = await app.ctx.db.query.entitlements.findFirst({ where: and(eq(entitlements.userId, cong), eq(entitlements.sourceType, 'automation'), eq(entitlements.resourceType, 'tier')) });
    expect(ent!.status).toBe('active');
    expect(Math.round((ent!.expiresAt!.getTime() - Date.now()) / 86_400_000)).toBe(30);
    // Đã có tài khoản và email đã xác minh: không gửi email kích hoạt.
    expect(emailsTo('congtran@gmail.com').some((m) => m.template === 'activation_invite')).toBe(false);

    const list = await members.listMembers(owner, kd, { tag: 'vip_30' });
    expect(list.items.map((m) => m.user.email)).toEqual(['congtran@gmail.com']);
    expect(list.items[0]!.tags).toEqual(['vip_30']);

    await automation.removeContactTag(owner, kd, made.id, 'vip_30');
    expect((await memberOf())).toMatchObject({ tierId: standard!.id, status: 'active' });
    expect((await app.ctx.db.query.entitlements.findFirst({ where: eq(entitlements.id, ent!.id) }))!.status).toBe('revoked');
  });

  it('hết hạn dùng thì cron thu hồi', async () => {
    const owner = await app.as('minhquy');
    const duy = await app.ids('user:duy');
    const standard = await app.ctx.db.query.communityTiers.findFirst({ where: and(eq(communityTiers.communityId, kd), eq(communityTiers.key, 'standard')) });
    const made = await automation.createContact(owner, kd, { email: 'duynguyen@gmail.com', tags: ['vip_30'] });
    const grant = await app.ctx.db.query.automationGrants.findFirst({ where: eq(automationGrants.contactId, made.id) });
    expect(grant!.status).toBe('applied');
    expect(await engine.expireAutomationGrants(app.system())).toBe(0);
    await app.ctx.db.update(automationGrants).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(automationGrants.id, grant!.id));
    expect(await engine.expireAutomationGrants(app.system())).toBe(1);
    expect((await app.ctx.db.query.automationGrants.findFirst({ where: eq(automationGrants.id, grant!.id) }))!.status).toBe('expired');
    expect((await app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.userId, duy), eq(communityMembers.communityId, kd)) }))!.tierId).toBe(standard!.id);
  });

  it('hội thu phí: khách mới kích hoạt xong là thành viên, gỡ thẻ thì rời hội; quy tắc không có bước email vẫn gửi thư mời kích hoạt', async () => {
    const owner = await app.as('minhquy');
    const email = 'cong.su.moi@example.com';
    await automation.createRule(owner, kd, { name: 'Vào hội Cộng sự', tag: 'partner', actions: [{ type: 'grant_membership', communityId: congsu, tierKey: 'premium', durationDays: null }] });
    await automation.receiveInbound(app.system(), tokenOf(sourceUrl), { name: 'Cộng Sự Mới', email, tags: ['partner'] });
    const [mail] = emailsTo(email);
    expect(mail!.template).toBe('activation_invite');
    expect(mail!.html).toContain('Cộng sự MMO');
    const r = await engine.activate(app.anon(), app.auth, claimTokenIn(mail!.html), { name: 'Cộng Sự', password: 'matkhau-moi-123' });
    expect(r.redirect).toBe('/cong-su-mmo/hom-nay');
    const user = await app.ctx.db.query.users.findFirst({ where: eq(users.email, email) });
    const memberOf = () => app.ctx.db.query.communityMembers.findFirst({ where: and(eq(communityMembers.userId, user!.id), eq(communityMembers.communityId, congsu)) });
    expect(await memberOf()).toMatchObject({ status: 'active', role: 'member' });
    const contact = await app.ctx.db.query.contacts.findFirst({ where: eq(contacts.email, email) });
    await automation.removeContactTag(owner, kd, contact!.id, 'partner');
    expect(await memberOf()).toMatchObject({ status: 'churned', tierId: null });
  });

  it('người đã ngừng nhận email: bỏ email quảng bá nhưng vẫn nhận thư mời kích hoạt', async () => {
    const owner = await app.as('minhquy');
    const email = 'ngung.nhan@example.com';
    const made = await automation.createContact(owner, kd, { email, name: 'Ngừng Nhận' });
    const contact = await app.ctx.db.query.contacts.findFirst({ where: eq(contacts.id, made.id) });
    expect(await engine.unsubscribeContact(app.system(), contact!.unsubscribeToken)).toEqual({ sender: expect.any(String) });
    expect(await engine.unsubscribeContact(app.system(), 'khong-co')).toBeNull();
    await automation.addContactTag(owner, kd, made.id, 'paid_fbads');
    expect(emailsTo(email).map((m) => m.template)).toEqual(['activation_invite']);
    const runs = await automation.listRuns(owner, kd);
    expect(runs[0]!.results.map((x) => `${x.type}:${x.status}`)).toEqual(['grant_course:pending', 'send_email:skipped', 'activation_email:done']);
  });

  it('đăng ký thường bằng đúng email đó: xác minh email xong là quyền vào tài khoản', async () => {
    const owner = await app.as('minhquy');
    const email = 'tu.dang.ky@example.com';
    await automation.createContact(owner, kd, { email, tags: ['paid_fbads'] });
    const session = await register(app.anon(), app.auth, { email, name: 'Tự Đăng Ký', password: 'matkhau-moi-123', acceptTerms: true });
    expect((await canAccessCourse(app.anon(), session.user.id, fbads)).allowed).toBe(false);
    await verifyEmail(app.anon(), session.user.id, '482913');
    expect((await canAccessCourse(app.anon(), session.user.id, fbads)).allowed).toBe(true);
  });

  it('danh sách liên hệ lọc theo thẻ, kèm quyền đang giữ; xóa quy tắc thì bỏ quyền đang giữ', async () => {
    const owner = await app.as('minhquy');
    await automation.createContact(owner, kd, { email: 'cho.kich.hoat@example.com', tags: ['paid_fbads'] });
    const list = await automation.listContacts(owner, kd, { tag: 'paid_fbads', q: 'cho.kich' });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ hasAccount: false, tags: [{ name: 'paid_fbads' }], grants: [{ kind: 'course', status: 'pending', title: 'Khóa học Facebook Ads chuyển đổi 2026' }] });
    expect((await automation.resendActivation(owner, kd, list.items[0]!.id)).token).toMatch(/^[a-f0-9]{48}$/);
    const tags = await automation.listTags(owner, kd);
    expect(tags.find((t) => t.name === 'paid_fbads')).toMatchObject({ ruleCount: 1 });
    const rules = await automation.listRules(owner, kd);
    const rule = rules.find((r) => r.tag === 'paid_fbads')!;
    expect(rule.summary).toEqual(['Mở khóa học Facebook Ads chuyển đổi 2026', 'Gửi email "Chào {{name}}, khóa học đã mở"']);
    await automation.deleteRule(owner, kd, rule.id);
    const after = await automation.listContacts(owner, kd, { q: 'cho.kich' });
    expect(after.items[0]!.grants).toEqual([]);
  });
});
