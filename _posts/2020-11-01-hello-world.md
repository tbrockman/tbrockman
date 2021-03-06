---
layout: post
title: hello world 👋
date: 2020-11-01 18:18:00 -0700
author: Theodore Brockman
categories: security github oss utterances
excerpt: Come join me on a journey of discovery and disappointment as I investigate Utterances, a popular third-party GitHub application.
thumbnail: /assets/img/hello_world_thumbnail.png
---

Another day, another `hello world` software developer blog post. 

My first blog post is about me finding a small issue allowing abuse of an open-source application, me notifying the author poorly, the issue not being addressed, and me creating a fork that solves the problem.

Let's get into it. 

## Utterances

[Utterances](https://utteranc.es) is an open-source Typescript plugin which integrates with [GitHub](https://github.com) to allow comment sections backed by [GitHub issues](https://github.com/tbrockman/tbrockman.github.io/issues), which when you combine it with something like [GitHub pages](https://pages.github.com/), gives the ability to host a static website with comments, for **free**! It also looks pretty nice and works on mobile.

Being impressed by the plugin (and suspicious of things that implement OAuth flows), I was curious to know how this little comment section worked.

```html
<script src="https://utteranc.es/client.js"
        repo="tbrockman/tbrockman.github.io"
        issue-term="{{page.title}}"
        theme="github-light"
        crossorigin="anonymous"
        async>
```

With the above script included on your webpage, Utterances will inject an iframe at the scripts location, and attempt to retrieve the comments linked to an issue specified by the repo and issue-term. It will then render all comments (with remarkably similar styling to GitHub) in its place.

## Helpful features

It's one more step to navigate to GitHub directly to post comments on an issue itself, so the author implemented a simple OAuth flow that allows user to permit the app access to create comments on their behalf, which is pretty nice!

![Utterances sign-in to comment](/assets/img/utterance_signin_to_comment.png)

*which then brings you to...*

![Utterances OAuth prompt](/assets/img/utterance_oauth_prompt.png)

And afterwards you're able to comment, *just like you're on GitHub!*

![Utterances comments](/assets/img/utterance_comments.png)

Usually I just give access to any of my accounts whenever anyone asks for it (*what's the worst that could happen?*), but the application is open-source so I thought I may aswell peek around a little bit.

## Investigation

Tracing the code from the start of the flow, we see the `Sign in to comment` button sends us to an endpoint from the Utterances API with a redirect parameter back to our original website.

[`utterances/src/new-comment-component.ts#L72`](https://github.com/utterance/utterances/blob/master/src/new-comment-component.ts#L72)
```html
<a class="btn btn-primary" href="${getLoginUrl(page.url)}" target="_top">Sign in to comment</a>
```

[`utterances/src/oauth.ts#L7`](https://github.com/utterance/utterances/blob/master/src/oauth.ts#L7)
```javascript
export function getLoginUrl(redirect_uri: string) {
  return `${UTTERANCES_API}/authorize?${param({ redirect_uri })}`;
}
```

Going to the backend code, you can see that the Utterances API generates some secret state and builds a redirect URL to request the necessary scopes for the user from GitHub, and sets a URL where the user will be redirected should they approve the request.

[`utterances-oauth/src/routes.ts#L74`](https://github.com/utterance/utterances-oauth/blob/master/src/routes.ts#L74)
```javascript
async function authorizeRequestHandler(origin: string, search: URLSearchParams) {
  const { client_id, state_password } = settings;

  const appReturnUrl = search.get('redirect_uri');

  if (!appReturnUrl) {
    return badRequest(`"redirect_uri" is required.`);
  }

  const state = await encodeState(appReturnUrl, state_password);
  const redirect_uri = origin + '/authorized';
  return new Response(undefined, {
    status: 302,
    statusText: 'found',
    headers: {
      Location: `${authorizeUrl}?${new URLSearchParams({ client_id, redirect_uri, state })}`
    }
  });
}
```

Assuming successful parsing of authorization code and state (passed as URL query parameters), it uses the retrieved information for acquiring an access token from GitHub, which will then be stored as a cookie to be sent along with future requests to the Utterances API.

[`utterances-oauth/src/routes.ts#L123`](https://github.com/utterance/utterances-oauth/blob/master/src/routes.ts#L123)
```javascript
let accessToken: string;
try {
  const response = await fetch(accessTokenUrl, init);
  if (response.ok) {
    const data = await response.json();
    accessToken = data.access_token;
  } else {
    throw new Error(`Access token response had status ${response.status}.`);
  }
} catch (_) {
  return new Response('Unable to load token from GitHub.');
}

const url = new URL(returnUrl);
url.searchParams.set('utterances', accessToken);

return new Response(undefined, {
  status: 302,
  statusText: 'found',
  headers: {
    'Location': url.href,
    'Set-Cookie': `token=${accessToken}; Path=/token; HttpOnly; Secure; SameSite=None; Max-Age=${60 * 60 * 24 * 356}`
  }
});
```

So overall, a relatively fine and safe implementation. Utterances procurs an access token, and then sends it back for me to use to interact directly with the GitHub API. Perfectly reasonable.

*...for the most part.*

## Maybe too helpful

In order to be even *more* convenient, Utterances will sometimes go through the work of posting GitHub issues for you. If the issue the script references doesn't exist yet and someone tries to comment, the script will send a request to the Utterances API to create the missing issue.

![Utterance bot creating an issue](/assets/img/utterance_bot_issue_creation.png)

Looking into the code, we can see the section where if there is no issue, it sends a create issue request.

[`utterances/src/utterances.ts#L57`](https://github.com/utterance/utterances/blob/master/src/utterances.ts#L57)
```javascript
const submit = async (markdown: string) => {
  await assertOrigin();
  if (!issue) {
    issue = await createIssue(
      page.issueTerm as string,
      page.url,
      page.title,
      page.description || '',
      page.label
    );
    timeline.setIssue(issue);
  }
  const comment = await postComment(issue.number, markdown);
  timeline.insertComment(comment, true);
  newCommentComponent.clear();
};
```

The handler for that request is so eager to please, it almost immediately starts to create the specified issue for you, it only checks that you're an authenticated GitHub user first.

[`utterances-oauth/src/routes.ts#L123`](https://github.com/utterance/utterances-oauth/blob/master/src/routes.ts#L123)
```javascript
const authInit = {
  method: 'GET',
  headers: {
    'Authorization': authorization,
    'User-Agent': 'utterances'
  }
};

let authenticated = false;
try {
  const response = await fetch('https://api.github.com/user', authInit);
  authenticated = response.ok;
} catch (_) {
}
if (!authenticated) {
  return new Response(undefined, { status: 401, statusText: 'not authorized' });
}

const init = {
  method: 'POST',
  headers: {
    'Authorization': 'token ' + settings.bot_token,
    'User-Agent': 'utterances',
  },
  body: request.body
};
try {
  const response = await fetch(`https://api.github.com${path}`, init);
  ...
```

This means that any authenticated GitHub user can use the Utterances API to create issues anywhere the bot is allowed. A single account could be used by a malicious actor to cause all incoming requests to the application fail, simply by consuming the bots rate-limit for issue creation.

## Proof of concept

As someone who rarely informs others of application vulnerabilities, I made an error before responsibly disclosing the issue. Initially, I wanted to test out what I had found (and didn't believe it would honestly work), so I sent a handcrafted request to the Utterances API server which ended up [working and immediately unveiling the vulnerability](https://github.com/utterance/utterances/issues/380).

![Testing the Utterances vulernability]({% link /assets/img/utterance_testing_vulnerability.png %})

Frantically, realizing I had goofed, I sought to contact the author in an e-mail and apologize for my lack of tact:
> **Theo:**
> 
> Hey! I recently found out about Utterances and was super excited to implement it into my own website as I work through a redesign, and then became curious as to how things worked on the backend to prevent things like people maliciously spamming GitHub issue creation using the API token that the API provides to the client.
> 
> Not to cause you too much alarm or anything, and perhaps you're already aware of this, but the way the backend is currently setup allows anyone to take that token and create arbitrarily many GitHub issues on any configured repositories, proof of the vulnerability here: [https://github.com/utterance/utterances/issues/380](https://github.com/utterance/utterances/issues/380) (sorry for testing this out in a public place, in retrospect I realize this wasn't very tactful and I didn't think about it until after it was already done)
> 
> That said, I'm very passionate about the project, and if GitHub doesn't have any plans to adopt Utterances directly into GitHub pages or anything that would make my work obsolete, I would love to help address the vulnerability!

After taking a few days to reply, the author indicated they did not believe this to be an issue:

> **Author:**
> 
> Hi Theodore,
> 
> I don't think this is a vulnerability. The API token generated by utterances is specific to the user. Any user can generate a much more permissive personal access token using the github user interface:
[https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token#creating-a-token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token#creating-a-token)

I began to doubt myself and whether what I had found really *was* a problem. Was my understanding of the backend flawed? Did I know *anything*? Was I just an overeager *dumb dumb*? 

I decided I just hadn't been clear enough in my communication:

> **Theo:**
> 
> Sorry, let me try to describe some of what the flow of the backend seems like, and what potential issues could arise as a result (and I did have a misconception initially, I thought the token being passed back to the client was Utterances application token):
> 
> 1. For the issue creation API endpoint, Utterances uses the access token provided to make a request to [https://api.github.com/user](https://api.github.com/user), verifying that the token belongs to an authenticated user
>     - **Issue**: Without any rate-limiting on this endpoint, a malicious user can spam this endpoint (either with a valid or invalid token), and consume the rate limit budget of the IP address, meaning that subsequent requests to determine whether a user is valid from the same IP address would fail, and so all issue creation from that IP address would fail for Utterance users.
> 2. **[Bigger problem]** For the issue creation API endpoint, Utterances uses its own token to create the issue once verifying the the request originated from an authenticated user
>    - **Issue**: Without rate-limiting or validation, a malicious user with a valid token can spam this endpoint and consume the rate limit budget of the application, creating many issues that will be traceable to the Utterances bot (which could potentially get the application removed), as well as preventing the creation of issues through the bot for legitimate users (due to the rate limit being reached).
> 
> Of course there's the possibility I've misunderstood the backend code, but hopefully this clarifies what I see as potential issues!

Through incredible verbosity I was successful. They lowered their guard:

> **Author**:
>
> 1 and 2 are correct. Utterances relies on github's rate limiting. It would not make sense to create issues with the user's access token because the user would later be able to modify the title/body resulting in the issue becoming unlinked from the blog post.

... I then ruined my progress but suggesting a pretty poor fix that was:
1. Overcomplicated
2. Required **more** server-side processing and resources
3. Wrong

Needless to say I lost the authors faith, and have not yet heard back.

## Onward and upward

I don't blame the author for not responding. I can't imagine it's enjoyable maintaining an open-source project for free, let alone having random strangers come to you with *more* work they want you to do. It would have been cool to work on fixing the problem together, but everything can't always work out the way you'd hoped.

But we persevere.

Ruminating on my failure a bit, I thought of more realistic ways to keep the same user-friendliness, while also avoiding having to deal with people who like to ruin things, and without spending more money.

The crux of the problem is that we want a way of automatically creating GitHub issues whenever we make a new blog post. For most people linking their blog posts to GitHub issues, they're probably hosting their blog on GitHub. For those people hosting their blog on GitHub, they're probably using [Jekyll](https://jekyllrb.com/).

From this, we can assume that any of our blog posts will reside in a folder (probably `_posts`), and if we have access to all the text within those files we can copy that to the GitHub issue if we want to, and if we want to we can do all of it using...

## GitHub Actions

Heard enough about these yet?

> "GitHub Actions usage is free for public repositories and self-hosted runners" - [GitHub](https://docs.github.com/en/free-pro-team@latest/github/setting-up-and-managing-billing-and-payments-on-github/about-billing-for-github-actions)


If you're using GitHub issues for blogs, your GitHub repo is probably public anyways, so this route is free so long as you're not creating more than one blog every few seconds or so. Within GitHub Actions, you even have access to a secret that contains an access token which you can use to create issues through the GitHub API.

I made [this GitHub Action](https://github.com/marketplace/actions/social-action) which, when given a configuration file `.github/social.yml` containing something like the following, will automatically create new issues for you as necessary:

```yml
api_version: v1/social # versioned configuration API

renderer: jekyll # this is the only format which is supported
                 # but perhaps one day there might be more
                                 
content: full # what type of content to display for the post 
              # 'full' will display entire blog post in the GitHub issue
              # there are currently no other modes

base_url: 'https://theo.lol' # used for resolving relative links

paths:       # list of Glob patterns which will 
  - _posts/* # match blog posts to create issues from
```

It imports Jekyll, renders any posts it has to, and then uses the rendered content to create issues as necessary.

After finishing the GitHub action I deployed my own version of the API which *doesn't* bend over backwards to create issues for you, and set a fork of the Utterances client to point to it (which you can find and use [here](https://theo.lol/client.js)). It doesn't contain any of the automatic issue creation code.

That's it, that's all there is to it.

## Conclusion

I think I would get in trouble if I tried to name this application `GitHub Social`, but if anyone at Microsoft wants to make it a reality send me a message.

Let's just call it `Social` instead for now.


[You can start using it here.](https://github.com/marketplace/actions/social-action)


You can also check out the code on GitHub:

1. [The GitHub Action](https://github.com/tbrockman/social-action)
2. [Utterances API](https://github.com/tbrockman/social-oauth)
3. [Utterances](https://github.com/tbrockman/utterances)

And see how everything works in the comments below.