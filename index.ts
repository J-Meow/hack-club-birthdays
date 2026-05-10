import { SQL } from "bun"
// @ts-expect-error i don't have time to make a .d.ts file for this. deal with it, typescript
import jwt from "jsonwebtoken"
const sql = new SQL()
const loginURL =
    "https://auth.hackclub.com/oauth/authorize?client_id=" +
    process.env.HCA_CLIENT_ID +
    "&redirect_uri=http://localhost:3000/auth/callback&response_type=code&scope=slack_id"
function requireAuth(req: Bun.BunRequest) {
    let jwtData: { id: string; name: string; pfp: string }
    if (!req.cookies.get("bday-token")) throw null
    jwtData = jwt.verify(req.cookies.get("bday-token"), process.env.JWT_SECRET)
    return jwtData
}
Bun.serve({
    port: 3000,
    routes: {
        "/": async (req) => {
            let jwtData: { id: string; name: string; pfp: string }
            try {
                jwtData = requireAuth(req)
            } catch (_) {
                return Response.redirect(loginURL)
            }
            return new Response(await Bun.file("index.html").text(), {
                headers: { "Content-Type": "text/html" },
            })
        },
        "/birthday": async (req) => {
            if (req.method != "POST") {
                return new Response(null, { status: 405 })
            }
            let jwtData
            try {
                jwtData = requireAuth(req)
            } catch (_) {
                return Response.redirect(loginURL)
            }
            const body = (await req.body!.json()) as {
                month: number | null
                day: number | null
            }
            if (!body.month || !body.day) {
                await sql`UPDATE users SET "bday_day"=NULL, "bday_month"=NULL WHERE "id"=${jwtData.id}`
            } else {
                const birthdayDate = new Date(2000, body.month, body.day)
                await sql`UPDATE users SET "bday_day"=${birthdayDate.getDate()}, "bday_month"=${birthdayDate.getMonth()} WHERE "id"=${jwtData.id}`
            }
            return new Response(null)
        },
        "/auth/me": async (req) => {
            try {
                let jwtData = requireAuth(req)
                let bdayInfo = (
                    await sql`SELECT "bday_month", "bday_day" FROM users WHERE id=${jwtData.id}`
                )[0]
                return Response.json({
                    id: jwtData.id,
                    name: jwtData.name,
                    pfp: jwtData.pfp,
                    bdayMonth: bdayInfo.bday_month,
                    bdayDay: bdayInfo.bday_day,
                })
            } catch (_) {
                return Response.redirect(loginURL)
            }
        },
        "/month/:month": async (req) => {
            try {
                requireAuth(req)
            } catch (_) {
                return Response.redirect(loginURL)
            }
            const bdays =
                await sql`SELECT "id", "name", "pfp", "bday_month", "bday_day" FROM users WHERE bday_month=${req.params.month}`
            return Response.json(bdays)
        },
        "/logout": () => {
            return new Response(null, {
                status: 302,
                headers: {
                    "Set-Cookie": `bday-token=logout;Max-Age=0`,
                    Location: "/",
                },
            })
        },
        "/auth/callback": async (req) => {
            const code = new URL(req.url).searchParams.get("code")
            if (!code) return Response.redirect("/")
            const oauthResponse = (await (
                await fetch("https://auth.hackclub.com/oauth/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        client_id: process.env.HCA_CLIENT_ID,
                        client_secret: process.env.HCA_CLIENT_SECRET,
                        redirect_uri: "http://localhost:3000/auth/callback",
                        grant_type: "authorization_code",
                        code,
                    }),
                })
            ).json()) as { access_token: string }
            const slackId = (
                (await (
                    await fetch("https://auth.hackclub.com/api/v1/me", {
                        headers: {
                            Authorization:
                                "Bearer " + oauthResponse.access_token,
                        },
                    })
                ).json()) as { identity: { slack_id: string } }
            ).identity.slack_id
            console.log(slackId)
            if (!slackId) return Response.redirect("/")
            const slackInfo = (await (
                await fetch(
                    "https://slack.com/api/users.info?user=" + slackId,
                    {
                        headers: {
                            Authorization: "Bearer " + process.env.SLACK_XOXB,
                        },
                    },
                )
            ).json()) as {
                ok: boolean
                user: { profile: { display_name: string; image_512: string } }
            }
            if (
                !slackInfo.ok ||
                !slackInfo.user.profile.display_name ||
                !slackInfo.user.profile.image_512
            ) {
                return Response.redirect("/")
            }
            console.log(slackInfo.user.profile.display_name)
            const token = jwt.sign(
                {
                    id: slackId,
                    name: slackInfo.user.profile.display_name,
                    pfp: slackInfo.user.profile.image_512,
                },
                process.env.JWT_SECRET,
            ) as string
            if ((await sql`SELECT FROM users WHERE id=${slackId}`).length) {
                await sql`UPDATE users SET "name"=${slackInfo.user.profile.display_name}, "pfp"=${slackInfo.user.profile.image_512} WHERE "id"=${slackId}`
            } else {
                await sql`INSERT INTO users("id", "name", "pfp") VALUES(${slackId}, ${slackInfo.user.profile.display_name}, ${slackInfo.user.profile.image_512})`
            }
            return new Response(null, {
                status: 302,
                headers: {
                    "Set-Cookie": `bday-token=${token};HttpOnly;Path=/`,
                    Location: "/",
                },
            })
        },
    },
})

